def get_number(prompt):
    """Prompt the user for a number and handle invalid inputs."""
    while True:
        try:
            return float(input(prompt))
        except ValueError:
            print("Error: Invalid number. Please enter a valid numeric value.")

def main():
    print("====================================")
    print("      Interactive Calculator        ")
    print("====================================")

    while True:
        print("\nChoose an operation:")
        print("1. Addition (+)")
        print("2. Subtraction (-)")
        print("3. Multiplication (*)")
        print("4. Division (/)")
        print("5. Exit")

        choice = input("Enter choice (1-5): ").strip()

        if choice == '5':
            print("\nThank you for using the calculator. Goodbye!")
            break

        if choice not in ['1', '2', '3', '4']:
            print("Error: Invalid choice. Please select an option between 1 and 5.")
            continue

        num1 = get_number("Enter the first number: ")
        num2 = get_number("Enter the second number: ")

        if choice == '1':
            result = num1 + num2
            op = '+'
        elif choice == '2':
            result = num1 - num2
            op = '-'
        elif choice == '3':
            result = num1 * num2
            op = '*'
        elif choice == '4':
            if num2 == 0:
                print("\nError: Division by zero is not allowed.")
                continue
            result = num1 / num2
            op = '/'

        # Format output cleanly: print integers if the values are whole numbers
        num1_str = str(int(num1)) if num1.is_integer() else str(num1)
        num2_str = str(int(num2)) if num2.is_integer() else str(num2)
        result_str = str(int(result)) if result.is_integer() else str(result)

        print(f"\nResult: {num1_str} {op} {num2_str} = {result_str}")
        print("-" * 36)

if __name__ == "__main__":
    main()
