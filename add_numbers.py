def main():
    print("--- Simple Addition Script ---")
    try:
        # Prompt the user for the first number
        num1_input = input("Enter the first number: ")
        num1 = float(num1_input)

        # Prompt the user for the second number
        num2_input = input("Enter the second number: ")
        num2 = float(num2_input)

        # Perform the addition
        result = num1 + num2

        # Format output: print as integers if both inputs are integers
        if num1.is_integer() and num2.is_integer():
            print(f"\nResult: {int(num1)} + {int(num2)} = {int(result)}")
        else:
            print(f"\nResult: {num1} + {num2} = {result}")

    except ValueError:
        print("\nError: Invalid input. Please enter numerical values.")

if __name__ == "__main__":
    main()
