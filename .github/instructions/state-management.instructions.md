# State Management

- Use Immer for immutable state updates.
- Use React Query for async state.
- Prefer local state over global unless needed.
- Manage edit/form states in Client Components using `useState`.
- Pass state and setters between related Client Components as props.
- Use Client Component wrappers to bridge Server/Client boundaries when event handlers are needed.
- Reset form and editing state after successful operations to maintain clean UI state.
