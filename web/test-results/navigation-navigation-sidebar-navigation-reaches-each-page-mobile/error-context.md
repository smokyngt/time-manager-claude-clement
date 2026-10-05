# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e6]:
      - img [ref=e8]
      - generic [ref=e11]: Time Manager
    - generic [ref=e12]:
      - generic [ref=e13]:
        - heading "Welcome back" [level=3] [ref=e14]
        - paragraph [ref=e15]: Sign in to track your time
      - generic [ref=e16]:
        - generic [ref=e17]:
          - alert [ref=e18]:
            - img [ref=e19]
            - generic [ref=e21]: Something went wrong. Please try again.
          - generic [ref=e22]:
            - text: Email
            - textbox "Email" [ref=e23]:
              - /placeholder: you@company.com
              - text: admin@e2e.test
          - generic [ref=e24]:
            - text: Password
            - textbox "Password" [ref=e25]: e2e-admin-password-123
          - button "Sign in" [ref=e26]
        - generic [ref=e27]: or
        - link "Sign in with Microsoft" [ref=e30] [cursor=pointer]:
          - /url: /v1/auth/microsoft
          - img
          - text: Sign in with Microsoft
    - paragraph [ref=e31]: Accounts are created by your manager.
  - region "Notifications alt+T"
```