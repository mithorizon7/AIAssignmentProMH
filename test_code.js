// Sample JavaScript code for testing file type validation
function calculateFactorial(n) {
  if (n === 0 || n === 1) {
    return 1;
  }
  return n * calculateFactorial(n - 1);
}

console.log("Factorial of 5 is", calculateFactorial(5));
