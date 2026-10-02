# Bug: Application Crash on 0 Months
- **Steps to Reproduce:** Enter Loan Amount: 10000, Interest: 5%, Period: 0 months. Click "Calculate Payment".
- **Expected Behavior:** Show a validation warning: "Loan period must be at least 1 month."
- **Actual Behavior:** Table displays infinite rows or crashes browser tab due to division by zero.
