# Spec: Bank Details Update Functionality and Button Text

## Overview

This spec outlines the required changes to the Bank Details form to support updating existing bank records and to conditionally display the button text as "Create" or "Update" based on the user's selection.

## Requirements

### 1. Button Text Logic

- The submit button should display "Update" when an existing bank is selected from the dropdown.
- The button should display "Create" when no bank is selected (i.e., creating a new bank).

### 2. Update Functionality

- When an existing bank is selected and the form is submitted, the form should update the selected bank's details instead of creating a new record.
- The mutation payload must include the bank's ID when updating.
- The backend mutation (tRPC endpoint) must support updating a bank when an ID is provided, and creating a new bank when no ID is provided.
- After a successful update, the form should reset and the selection should be cleared.

### 3. UX Improvements (Optional)

- Add a "Cancel" button to clear the selection and reset the form to create mode.

## Implementation Steps

1. Update the frontend form logic to:
   - Track whether a bank is being edited (selectedBank state).
   - Conditionally render the button text.
   - Pass the bank ID to the mutation when updating.
2. Update the backend tRPC mutation to:
   - Accept an optional ID and update the record if present.
   - Create a new record if no ID is provided.
3. Test both create and update flows for correctness.
4. (Optional) Add a "Cancel" button to reset the form.

## File Naming

- This spec file: `spec/bank-details-update-functionality.md`

---

## Acceptance Criteria

- [ ] Button text changes to "Update" when editing an existing bank.
- [ ] Submitting the form with a selected bank updates the record.
- [ ] Submitting the form with no selected bank creates a new record.
- [ ] Backend mutation supports both create and update.
- [ ] (Optional) Cancel button resets the form and selection.
