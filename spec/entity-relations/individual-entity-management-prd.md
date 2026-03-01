# PRD: Individual Entity Management

## 1. Product overview

### 1.1 Document title and version

- PRD: Individual Entity Management
- Version: 1.0.0

### 1.2 Product summary

- This feature introduces comprehensive Individual entity management to the platform, allowing users to create, update, and delete individual records. The form and data model will mirror the existing Business Details functionality, with "Individual" replacing "Business." The solution includes a dynamic relationship field that allows users to select from existing relationships or create new ones, with optional address details using the shared Address component. The system maintains user-scoped data and enforces unique individual names per user.

## 2. Goals

### 2.1 Business goals

- Enable users to manage individual records efficiently for financial tracking and relationship management.
- Ensure data consistency and prevent duplicate individual entries per user.
- Provide flexible relationship management with user-specific relationship options.
- Lay the groundwork for future address support across different geographical regions.

### 2.2 User goals

- Add new individuals with required details and optional address information.
- Edit and update existing individual information.
- Select from existing relationships or create new relationship types dynamically.
- Maintain organized records of individuals for financial and personal tracking.

### 2.3 Non-goals

- Individual deletion functionality (to be considered in a future iteration).
- Advanced individual attributes (e.g., tax information, detailed contact info).
- Global relationship sharing across users.

## 3. User personas

### 3.1 Key user types

- General users

### 3.2 Basic persona details

- **General User**: Manages their own individual records for financial tracking, relationship management, and personal organization.

### 3.3 Role-based access

- **General User**: Can create, update, and view their own individual records and relationships.

## 4. Functional requirements

**Individual CRUD operations** (Priority: High)

- Users can create, update, and view individual records.
- The form fields include Individual Name, Individual Relation, and optional Address details.
- Individual Name is required and must be unique per user (case-insensitive).
- Individual Relation field supports both selection from existing relations and creation of new relations.
- Relation field has a 150-character limit and is user-scoped.
- Address input uses the shared Address component with all fields optional.
- Button text changes to "Update" when editing an existing individual.
- Form is pre-populated when selecting an existing individual from the dropdown.
- Unique individual name constraint enforced at both client and server levels.
- All relation values are stored per user and appear in future dropdown options.

**Dynamic Relationship Management** (Priority: High)

- Dropdown shows previously created relationships for the user.
- User can type new relationship names if not found in existing options.
- Visual indication when creating a new relationship.
- New relationships are automatically added to user's relationship list.
- Common relationship examples: Mother, Father, Friend, Brother, Sister, Spouse, etc.
- Relationship field is optional but recommended.

## 5. User experience

### 5.1 Entry points & first-time user flow

- Accessible from the "Individual" section under Relations in the app navigation.
- First-time users see an empty state with a prompt to add their first individual.

### 5.2 Core experience

- **Add individual**: User fills out the form with name, relationship, and optional address, then submits to create.
  - Clear error messages for validation failures.
- **Edit individual**: Selecting an individual from the dropdown populates the form for editing.
  - Button text changes to "Update."
- **Relationship selection**: User can select from existing relationships or type new ones.
  - Visual feedback when creating new relationships.

### 5.3 Advanced features & edge cases

- Prevent duplicate individual names per user.
- Handle address validation errors consistently across the app.
- Support for future expansion to non-AU addresses.
- Efficient relationship dropdown with search/filter capabilities.

### 5.4 UI/UX highlights

- Consistent form layout with Business Details for familiarity.
- Responsive design for desktop and mobile.
- Accessible form fields with proper labels and error messages.
- Smooth dropdown interaction with create-new-option functionality.

## 6. Narrative

A general user navigates to the Individual section, adds a new individual by filling out their name, selecting or creating a relationship type, and optionally adding address details. The form provides immediate feedback and enforces data quality, ensuring each individual is uniquely identified and relationships are properly managed. Users can later edit individuals by selecting them from the dropdown, which automatically populates the form for easy updates.

## 7. Success metrics

### 7.1 User-centric metrics

- Number of individuals created/updated per user.
- Form completion rates and error rates.
- Relationship creation vs. selection rates.

### 7.2 Business metrics

- Increase in user engagement with individual management features.
- Reduction in duplicate individual records.
- Growth in relationship diversity per user.

### 7.3 Technical metrics

- Validation error rates for individual and address fields.
- Performance of relationship dropdown with large datasets.
- No critical bugs in CRUD operations.

## 8. Technical considerations

### 8.1 Integration points

- Shared Address component (used across Bank, Business, and Individual entities).
- tRPC API for CRUD operations.
- Dynamic relationship management system.
- User session management for data scoping.

### 8.2 Data storage & privacy

- Individual records stored in the database, linked to user accounts.
- Relationships are user-scoped and private.
- Address data validated and stored with flexibility for global formats.
- Unique constraints enforced at the database level.

### 8.3 Scalability & performance

- Efficient queries for individual listing and relationship lookup.
- Address component designed for future extensibility.
- Optimized dropdown performance for users with many relationships.

### 8.4 Potential challenges

- Ensuring unique individual names without race conditions.
- Managing relationship dropdown performance with growing datasets.
- Consistent error handling across all forms using the Address component.
- Maintaining data consistency during concurrent user operations.

## 9. Milestones & sequencing

### 9.1 Project estimate

- Medium: 4-6 days

### 9.2 Team size & composition

- 1-2 developers (frontend & backend)

### 9.3 Suggested phases

- **Phase 1**: Extend Individual database schema and backend services (1-2 days)
  - Add address fields, update services and controllers.
- **Phase 2**: Implement Individual CRUD UI with relationship management (2-3 days)
  - Core form, dropdown with create-new functionality, and API integration.
- **Phase 3**: Integrate Address component and implement validation (1 day)
  - Ensure consistent validations and error handling.
- **Phase 4**: Polish UI/UX, add tests, and document (1 day)
  - Final testing, accessibility improvements, and documentation.

## 10. User stories

### 10.1. Create individual

- **ID**: GH-009
- **Description**: As a user, I want to add a new individual with their name, relationship, and optional address details, so that I can track people important to my financial and personal life.
- **Acceptance criteria**:
  - User can access the individual creation form.
  - Individual Name field is required and validated for uniqueness per user.
  - Individual Relation field allows selection from existing relations or creation of new ones.
  - Address fields are all optional and use the shared Address component.
  - Individual is saved and appears in the dropdown list.
  - New relationships are added to the user's relationship options.

### 10.2. Update individual

- **ID**: GH-010
- **Description**: As a user, I want to update an existing individual's information so that I can keep their details current and accurate.
- **Acceptance criteria**:
  - User can select an individual from the dropdown to edit.
  - Form is pre-filled with existing data including name, relationship, and address.
  - User can update any field and save changes.
  - Button text changes to "Update" when editing.
  - Updated relationship options are preserved for future use.

### 10.3. Select and populate individual details

- **ID**: GH-011
- **Description**: As a user, I want to select an individual from a dropdown list so that the form is automatically populated with their details for easy editing.
- **Acceptance criteria**:
  - A Select dropdown shows all previously created individuals.
  - When an individual is selected, all their details populate in the form fields.
  - The dropdown is searchable and accessible.
  - The user can clear the selection to start fresh.

### 10.4. Dynamic relationship management

- **ID**: GH-012
- **Description**: As a user, I want to select from existing relationships or create new relationship types dynamically, so that I can properly categorize individuals without being limited to predefined options.
- **Acceptance criteria**:
  - Relationship dropdown shows all previously created relationships for the user.
  - User can type a new relationship name if it doesn't exist.
  - Visual indication is provided when creating a new relationship.
  - New relationships are automatically added to the user's options.
  - Relationship field has a 150-character limit.
  - Common relationship examples work seamlessly (Mother, Father, Friend, etc.).

### 10.5. Unique individual name constraint

- **ID**: GH-013
- **Description**: As a user, I want to be prevented from creating individuals with duplicate names so that my records remain unique and organized.
- **Acceptance criteria**:
  - Attempting to create an individual with a duplicate name (case-insensitive) shows an error.
  - Client-side validation provides immediate feedback during typing.
  - Server-side validation ensures data integrity on submission.
  - Clear error messages indicate the uniqueness requirement.
  - Validation works for both create and update operations.

### 10.6. Optional address integration

- **ID**: GH-014
- **Description**: As a user, I want to optionally add address information for individuals using the same address component used elsewhere in the app, so that I can maintain location information when relevant.
- **Acceptance criteria**:
  - Address section uses the shared AddressComponent.
  - All address fields are optional.
  - Address validation follows existing patterns but doesn't block submission.
  - Address component is designed for future global support.
  - Form submission works with or without address information.

### 10.7. Authentication & authorization

- **ID**: GH-015
- **Description**: As a user, I want to ensure only I can manage my own individual records and relationships, so that my personal data remains private and secure.
- **Acceptance criteria**:
  - Only authenticated users can create, update, or view individuals.
  - Users cannot access or modify other users' individual records.
  - Relationships are scoped to the logged-in user.
  - All API endpoints enforce user-based authorization.

### 10.8. Individual name uniqueness validation (Client + Server)

- **ID**: GH-016
- **Description**: As a user, I want to be prevented from creating or updating an individual with a name that already exists in my account (case-insensitive), with clear error messages, so that my individual records remain unique and I avoid confusion.
- **Acceptance criteria**:
  - Client-side validation checks against existing individual names (case-insensitive) and shows errors before submission.
  - Server-side validation ensures individual names are unique per user (case-insensitive).
  - Clear, user-friendly error messages indicate that individual names must be unique.
  - Validation works for both create and update operations.
  - Error messages are consistent between client and server validation.

### 10.9. User-scoped relationship persistence

- **ID**: GH-017
- **Description**: As a user, I want my relationship types to be saved and available for future use when creating other individuals, so that I can maintain consistency in how I categorize relationships.
- **Acceptance criteria**:
  - When a user creates a new relationship, it's stored for their account.
  - Previously created relationships appear in the dropdown for future individual creation.
  - Relationships are only visible to the user who created them.
  - The relationship dropdown efficiently handles growing lists of relationships.
  - Relationships persist across user sessions.

### 10.10. Global address support with country selection

- **ID**: GH-018
- **Description**: As a user, I want to choose between Australian and Global address formats when entering address information for individuals, so that I can accurately capture address details regardless of the individual's location.
- **Acceptance criteria**:
  - A dropdown with "Australia" and "Global" options appears before the address fields.
  - "Australia" is selected by default to maintain current behavior.
  - When "Australia" is selected, the current AU address fields are displayed (Address autocomplete, Street Address, Suburb, Post Code, State).
  - When "Global" is selected, a single "Complete Address" text area is displayed for free-form address entry.
  - The selected address format and data are saved to the individual record.
  - Form validation works appropriately for both address formats.
  - Address format selection is preserved when editing existing individuals.
  - Global addresses are stored in a separate database field (`globalAddress`) to avoid conflicts with AU-specific fields.
  - The address component gracefully handles switching between formats without data loss.
  - Both address formats are optional and do not block form submission.

#### Notes

- The client-side validation is for UX enhancement; server-side validation is the authoritative source.
- Individual deletion functionality is intentionally excluded from this version and will be considered in future iterations.
- Address validation follows the existing AU-focused pattern but is designed for future global expansion.
- This PRD builds upon the established patterns from Business Entity Management for consistency and maintainability.
