# PRD: Business Entity Management

## 1. Product overview

### 1.1 Document title and version

- PRD: Business Entity Management
- Version: 1.0.0

### 1.2 Product summary

- This feature introduces a Business entity to the platform, allowing users to create, update, and delete business records. The form and data model will closely mirror the existing Bank Details functionality, with all references to "Bank" replaced by "Business." The solution will leverage the shared Address component, with current validation and formatting tailored for Australian addresses, but designed for future extensibility to global address formats.

## 2. Goals

### 2.1 Business goals

- Enable users to manage business records efficiently.
- Ensure data consistency and prevent duplicate business entries.
- Lay the groundwork for future global address support.

### 2.2 User goals

- Add new businesses with required details.
- Edit and update existing business information.
- Delete businesses as needed.

### 2.3 Non-goals

- Support for non-AU addresses (for now).
- Advanced business attributes (e.g., ABN, tax info).

## 3. User personas

### 3.1 Key user types

- General users

### 3.2 Basic persona details

- **General User**: Manages their own business records for financial tracking and reporting.

### 3.3 Role-based access

- **General User**: Can create, update, and delete their own business records.

## 4. Functional requirements

**Business CRUD operations** (Priority: High)

- Users can create, update, and delete business records.
- The form fields mirror those of Bank Details, with "Business" replacing "Bank."
- There is a required `type` select field, populated with values from the `BusinessEnumType` enum (`BANK`, `BUSINESS`, `PHILANTHROPY`).
- Address input uses the shared Address component.
- Button text changes to "Update" when editing an existing business.
- Unique business name constraint enforced.
- All fields required except for optional address fields (if any).
- Postcode must be numeric and 4 digits (AU format).
- State must be a valid AU state/territory code (dropdown).
- No special characters allowed in business name.
- Address component validations should be flexible for future global support.

## 5. User experience

### 5.1 Entry points & first-time user flow

- Accessible from a dedicated "Business" section in the app.
- First-time users see an empty state with a prompt to add their first business.

### 5.2 Core experience

- **Add business**: User fills out the form and submits to create a new business.
  - Clear error messages for validation failures.
- **Edit business**: Selecting a business from a list populates the form for editing.
  - Button text changes to "Update."
- **Delete business**: User can delete a business from the list with confirmation.

### 5.3 Advanced features & edge cases

- Prevent duplicate business names.
- Handle address validation errors consistently across the app.
- Allow for future expansion to non-AU addresses.

### 5.4 UI/UX highlights

- Consistent form layout with Bank Details.
- Responsive design for desktop and mobile.
- Accessible form fields and error messages.

## 6. Narrative

A general user navigates to the Business section, adds a new business by filling out the required details, and can later edit or delete the business as needed. The form provides clear feedback and enforces data quality, ensuring each business is uniquely identified and address data is valid for AU, with flexibility for future global support.

## 7. Success metrics

### 7.1 User-centric metrics

- Number of businesses created/updated/deleted per user.
- Form completion and error rates.

### 7.2 Business metrics

- Increase in user engagement with business management features.
- Reduction in duplicate business records.

### 7.3 Technical metrics

- Validation error rates for business and address fields.
- No critical bugs in CRUD operations.

## 8. Technical considerations

### 8.1 Integration points

- Shared Address component (used across Bank, Business, and other entities).
- tRPC API for CRUD operations.

### 8.2 Data storage & privacy

- Business records stored in the database, linked to user accounts.
- Address data validated and stored per AU format, with extensibility for global.

### 8.3 Scalability & performance

- Efficient queries for business listing and lookup.
- Address component designed for future extensibility.

### 8.4 Potential challenges

- Ensuring unique business names without race conditions.
- Keeping address validation flexible for future global support.
- Consistent error handling across all forms using the Address component.

## 9. Milestones & sequencing

### 9.1 Project estimate

- Medium: 3-5 days

### 9.2 Team size & composition

- 1-2 developers (frontend & backend)

### 9.3 Suggested phases

- **Phase 1**: Implement Business CRUD UI and backend (2-3 days)
  - Core form, list, and API endpoints.
- **Phase 2**: Integrate and test Address component (1 day)
  - Ensure validations and error handling are consistent.
- **Phase 3**: Polish UI/UX, add tests, and document (1 day)

## 10. User stories

### 10.1. Create business

**ID**: GH-001
**Description**: As a user, I want to add a new business with all required details, including selecting a business type, so that I can track my business entities.
**Acceptance criteria**:

- User can access the business creation form.
- All required fields, including the `type` select field (populated from `BusinessEnumType`), are validated.
- Business is saved and appears in the list.

### 10.2. Update business

- **ID**: GH-002
- **Description**: As a user, I want to update an existing business so that I can keep my business information current.
- **Acceptance criteria**:
  - User can select a business to edit.
  - Form is pre-filled with existing data.
  - User can update and save changes.
  - Button text changes to "Update."

### 10.3. Delete business

- **ID**: GH-003
- **Description**: As a user, I want to delete a business so that I can remove outdated or incorrect records.
- **Acceptance criteria**:
  - User can delete a business from the list.
  - Confirmation is required before deletion.
  - Business is removed from the list.

### 10.4. Unique business name constraint

- **ID**: GH-004
- **Description**: As a user, I want to be prevented from creating duplicate business names so that my records remain unique.
- **Acceptance criteria**:
  - Attempting to create a business with a duplicate name shows an error.
  - Only unique business names are allowed.

### 10.5. Address validation (AU only, extensible)

- **ID**: GH-005
- **Description**: As a user, I want address fields to be validated for AU format, but the system should be flexible for future global support.
- **Acceptance criteria**:
  - Postcode must be 4 digits.
  - State must be a valid AU code.
  - Address component can be extended for global support later.

### 10.6. Authentication & authorization

- **ID**: GH-006
- **Description**: As a user, I want to ensure only authorized users can manage their own business records.
- **Acceptance criteria**:
  - Only authenticated users can create, update, or delete businesses.
  - Users cannot access or modify other users' business records.

### 10.7. Select and populate business details

- **ID**: GH-007
- **Description**: As a user, I want to select a business from a dropdown list of previously created businesses so that the form is automatically populated with that business's details for easy editing.
- **Acceptance criteria**:
  - A Select dropdown is shown listing all previously created business entities.
  - When a business is selected from the dropdown, all of its details are populated in the form fields.
  - The user can edit the populated details and update the business.
  - The dropdown is accessible and supports searching/filtering if there are many businesses.
