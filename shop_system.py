import sys
import json
import os
import datetime

DB_FILE = "sales_history.json"

def load_sales_history():
    """Load sales transactions from a JSON file."""
    if not os.path.exists(DB_FILE):
        return []
    try:
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError:
        print("Warning: Sales history file is corrupted. Reinitializing sales database.")
        return []
    except Exception as e:
        print(f"Error loading sales history: {e}")
        return []

def save_sales_history(history):
    """Save sales transactions to a JSON file."""
    try:
        with open(DB_FILE, 'w') as f:
            json.dump(history, f, indent=4)
    except Exception as e:
        print(f"Error saving sales history: {e}")

def record_transaction(items, total_amount):
    """Save a new transaction into the history log."""
    history = load_sales_history()
    transaction = {
        "timestamp": datetime.datetime.now().isoformat(),
        "items": items,
        "total_amount": total_amount
    }
    history.append(transaction)
    save_sales_history(history)

def get_non_empty_input(prompt):
    """Prompt the user and ensure they provide a non-empty response."""
    while True:
        try:
            val = input(prompt).strip()
            if val:
                return val
            print("Error: Input cannot be empty. Please try again.")
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled. Returning to menu.")
            return None

def get_positive_float(prompt):
    """Prompt the user for a valid non-negative float price."""
    while True:
        try:
            val_str = input(prompt).strip()
            if val_str.lower() == 'done':
                return 'done'
            val = float(val_str)
            if val >= 0:
                return val
            print("Error: Price must be a non-negative number.")
        except ValueError:
            print("Error: Please enter a valid number for price.")
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.")
            return None

def checkout_flow():
    """Flow to let user enter commodities and check them out."""
    print("\n" + "=" * 50)
    print("           NEW TRANSACTION - ENTER ITEMS           ")
    print("     (Enter 'done' as the name to finish list)     ")
    print("=" * 50)
    
    commodities = []
    
    while True:
        name = get_non_empty_input(f"Item {len(commodities) + 1} Name: ")
        if name is None:
            return
        if name.lower() == 'done':
            if not commodities:
                print("Error: You must add at least one item before checking out.")
                confirm = input("Discard transaction and return to menu? (y/n): ").strip().lower()
                if confirm == 'y':
                    return
                continue
            break
            
        price = get_positive_float(f"Price for '{name}': $")
        if price is None:
            return
        if price == 'done':
            if not commodities:
                print("Error: List is empty. Returning to menu.")
                return
            break
            
        commodities.append({"name": name, "price": price})
        print(f"-> Added: {name} (${price:.2f})")

    # Display receipt
    print("\n" + "=" * 54)
    print("                 CUSTOMER RECEIPT                     ")
    print("=" * 54)
    print(f"{'No.':<4} | {'Commodity Name':<30} | {'Price ($)':>12}")
    print("-" * 54)
    
    subtotal = 0.0
    for idx, item in enumerate(commodities, 1):
        name = item['name']
        price = item['price']
        subtotal += price
        display_name = name[:27] + "..." if len(name) > 30 else name
        print(f"{idx:<4} | {display_name:<30} | {price:>12.2f}")
        
    print("-" * 54)
    avg_price = subtotal / len(commodities)
    max_item = max(commodities, key=lambda x: x['price'])
    min_item = min(commodities, key=lambda x: x['price'])
    
    print(f"{'Total Items:':<36} {len(commodities):>15}")
    print(f"{'Subtotal:':<36} ${subtotal:>14.2f}")
    print(f"{'Average Price per Item:':<36} ${avg_price:>14.2f}")
    print(f"{'Highest Priced Item:':<22} {max_item['name'][:12]:<12} (${max_item['price']:>6.2f})")
    print(f"{'Lowest Priced Item:':<22} {min_item['name'][:12]:<12} (${min_item['price']:>6.2f})")
    print("=" * 54)
    
    # Save the checkout transaction
    record_transaction(commodities, subtotal)
    print("\nTransaction checked out and recorded successfully!")

def admin_dashboard():
    """Admin Dashboard showing aggregates for Day, Week, and Month."""
    print("\n" + "=" * 50)
    print("                  ADMIN LOGIN                      ")
    print("=" * 50)
    
    password = input("Enter Admin Password: ").strip()
    if password != "andazi":
        print("\n[Access Denied] Incorrect password.")
        print("Returning to Main Menu.")
        return
        
    print("\n[Access Granted] Welcome, Boss!")
    
    history = load_sales_history()
    now = datetime.datetime.now()
    
    # Time boundaries
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - datetime.timedelta(days=7)
    month_start = now - datetime.timedelta(days=30)
    
    # Aggregation stores
    stats = {
        "today": {"sales": 0.0, "items_count": 0, "items_list": []},
        "week": {"sales": 0.0, "items_count": 0, "items_list": []},
        "month": {"sales": 0.0, "items_count": 0, "items_list": []}
    }
    
    for tx in history:
        try:
            tx_time = datetime.datetime.fromisoformat(tx["timestamp"])
        except ValueError:
            continue
            
        amount = tx.get("total_amount", 0.0)
        items = tx.get("items", [])
        items_qty = len(items)
        item_names = [it["name"] for it in items]
        
        # Aggregate stats
        # Today (same calendar day)
        if tx_time.date() == now.date():
            stats["today"]["sales"] += amount
            stats["today"]["items_count"] += items_qty
            stats["today"]["items_list"].extend(item_names)
            
        # Last 7 Days (Week)
        if tx_time >= week_start:
            stats["week"]["sales"] += amount
            stats["week"]["items_count"] += items_qty
            stats["week"]["items_list"].extend(item_names)
            
        # Last 30 Days (Month)
        if tx_time >= month_start:
            stats["month"]["sales"] += amount
            stats["month"]["items_count"] += items_qty
            stats["month"]["items_list"].extend(item_names)
            
    # Print Dashboard
    print("\n" + "=" * 60)
    print("                  BOSS ADMIN DASHBOARD                      ")
    print("=" * 60)
    
    periods = [
        ("TODAY (SIKU)", "today"),
        ("THIS WEEK (WIKI)", "week"),
        ("THIS MONTH (MWEZI)", "month")
    ]
    
    for label, key in periods:
        data = stats[key]
        print(f"\n--- {label} ---")
        print(f"Total Revenue:  ${data['sales']:.2f}")
        print(f"Total Items:    {data['items_count']}")
        if data['items_list']:
            # Unique items bought and their counts
            item_counts = {}
            for name in data['items_list']:
                item_counts[name] = item_counts.get(name, 0) + 1
            
            top_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            items_str = ", ".join([f"{name} ({qty})" for name, qty in top_items])
            if len(item_counts) > 5:
                items_str += f", and {len(item_counts) - 5} other different items"
            print(f"Items Bought:   {items_str}")
        else:
            print("Items Bought:   No sales recorded")
            
    print("\n" + "=" * 60)
    input("\nPress Enter to return to the Main Menu...")

def main():
    while True:
        print("\n" + "=" * 45)
        print("          STELLARSHOP - MAIN MENU          ")
        print("=" * 45)
        print("1. New Checkout Transaction (Add Items)")
        print("2. Admin Dashboard (Boss Login)")
        print("3. Exit System")
        print("-" * 45)
        
        choice = input("Enter choice (1-3): ").strip()
        
        if choice == '1':
            checkout_flow()
        elif choice == '2':
            admin_dashboard()
        elif choice == '3':
            print("\nThank you for using StellarShop. Goodbye!")
            break
        else:
            print("Error: Invalid option. Please select 1, 2, or 3.")

if __name__ == "__main__":
    main()
