def get_non_empty_input(prompt):
    """Prompt the user and ensure they provide a non-empty answer."""
    while True:
        user_input = input(prompt).strip()
        if user_input:
            return user_input
        print("Please enter a valid response.")

def main():
    print("=== Simple User Questionnaire ===")
    
    # 1. Ask the first question
    name = get_non_empty_input("1. What is your name? ")
    
    # 2. Ask the second question
    grandma_name = get_non_empty_input("2. What is your grandmother's name? ")
    
    # 3. Ask the third question
    location = get_non_empty_input("3. Where do you live? ")
    
    # Print the formatted answers appropriate to the questions
    print("\n=== Summary of Your Responses ===")
    print(f"Name:               {name}")
    print(f"Grandmother's Name: {grandma_name}")
    print(f"Location:           {location}")
    print("\nThank you for sharing!")

if __name__ == "__main__":
    main()
