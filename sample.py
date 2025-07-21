# Simple Python script to test file type validation
def is_prime(n):
    """Check if a number is prime."""
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True

# Test the function
for num in range(1, 20):
    if is_prime(num):
        print(f"{num} is prime")
    else:
        print(f"{num} is not prime")
