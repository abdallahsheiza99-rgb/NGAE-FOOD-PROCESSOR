def get_non_empty_input(prompt):
    """Prompt the user and ensure they provide a non-empty response."""
    while True:
        user_input = input(prompt).strip()
        if user_input:
            return user_input
        print("Error: Input cannot be empty. Please try again.")

def get_valid_age(prompt):
    """Prompt the user for a valid positive integer age."""
    while True:
        try:
            age = int(input(prompt).strip())
            if age > 0:
                return age
            print("Error: Age must be a positive number.")
        except ValueError:
            print("Error: Please enter a valid number for age.")

def main():
    print("==================================================")
    print("             Interview Questionnaire              ")
    print("==================================================")

    # 1. How old are you?
    age = get_valid_age("1. How old are you? ")

    # 2. What do you do for a living?
    job = get_non_empty_input("2. What do you do for a living? ")

    # 3. Why do you need this position?
    reason = get_non_empty_input("3. Why do you need this position? ")

    # 4. When will you get married?
    marriage_plan = get_non_empty_input("4. When will you get married? ")

    # 5. Tell us three characters of a woman you wish to marry
    print("5. Tell us three traits/characteristics of a woman you wish to marry:")
    traits = []
    for i in range(1, 4):
        trait = get_non_empty_input(f"   Trait {i}: ")
        traits.append(trait)

    # Print summary of the answers
    print("\n==================================================")
    print("             Summary of Interview                 ")
    print("==================================================")
    print(f"Age:                    {age}")
    print(f"Occupation:             {job}")
    print(f"Reason for Position:    {reason}")
    print(f"Marriage Plan:          {marriage_plan}")
    print(f"Desired Partner Traits: {', '.join(traits)}")
    print("==================================================")

if __name__ == "__main__":
    main()
