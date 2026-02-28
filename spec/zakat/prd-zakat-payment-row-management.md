# PRD: Zakat Payment Row Management

## 1. Product overview

### 1.1 Document title and version

- PRD: Zakat Payment Row Management
- Version: 1.0

### 1.2 Product summary

This feature enables authenticated users to manage (add, edit, and delete) individual Zakat Payment rows for a selected Zakat year. Each payment row records a partial or full payment towards the user's total Zakat obligation for that year. The feature ensures that users can accurately track their Zakat payments, manage installment payments, and maintain a clear record of beneficiaries.

## 2. Goals

### 2.1 Business goals

- Improve user engagement by providing granular Zakat payment tracking.
- Enhance transparency and record-keeping for Zakat contributions.
- Support compliance with religious and financial obligations.

### 2.2 User goals

- Easily add, edit, or delete Zakat payment records for a specific year.
- Track payment history and beneficiary details.
- Ensure payment records are accurate and up to date.

### 2.3 Non-goals

- Automatic calculation of total Zakat due.
- Management of payments for years other than the selected filter.
- Support for unauthenticated or guest users.

## 3. User personas

### 3.1 Key user types

- Authenticated individual users

### 3.2 Basic persona details

- **Individual user**: A person who tracks and manages their annual Zakat payments and beneficiaries.

### 3.3 Role-based access

- **Authenticated user**: Can add, edit, and delete their own Zakat payment rows for the selected year.

## 4. Functional requirements

- **Add Zakat payment row** (Priority: High)
  - Users can add a new payment row for the selected Zakat year.
  - Required fields: date paid, amount paid, beneficiary type, beneficiary.
  - Validations:
    - Amount must be positive, with up to two decimal places (e.g., 123.45), and entered in the user's default currency (e.g., USD, PKR).
    - Date must be in ISO 8601 format (YYYY-MM-DD), must not be in the future, and should be stored/validated in UTC timezone.
- **Edit Zakat payment row** (Priority: High)
  - Users can edit any of their payment rows for the selected year.
  - All validations from add apply.
- **Delete Zakat payment row** (Priority: High)
  - Users can delete any of their payment rows for the selected year.
- **Filter by Zakat year** (Priority: Medium)
  - CRUD operations only affect the currently selected year.
- **Authentication** (Priority: High)
  - Only authenticated users can access and modify their own payment rows.

## 5. User experience

### 5.1 Entry points & first-time user flow

- User logs in and navigates to the Zakat Payments page.
- User selects a Zakat year from the filter dropdown.
- User sees existing payment rows (if any) for the selected year in read-only table format.
- Empty table shows column headers: Date Paid, Amount Paid, Beneficiary Type, Beneficiary, Actions

### 5.2 Core experience

#### 5.2.1 Add payment workflow

- **Add Payment Trigger**: User clicks a `+` icon button within a rounded square shape (not circular) located above the payment table.
- **New Row Creation**: System immediately adds a new editable row at the bottom of the table with:
  - Date Paid: Interactive date picker field (calendar widget similar to `/settings/calendar` page)
  - Amount Paid: Numeric input field (initially empty, user must enter amount)
  - Beneficiary Type: Dropdown with options "Individual" and "Business"
  - Beneficiary: Filtered dropdown based on previously selected Beneficiary Type
  - Actions: Shows a `floppy disk save` icon for saving the new record
- **Field Interaction**:
  - Date field opens calendar picker when clicked
  - Amount field accepts numeric input with decimal precision
  - Beneficiary Type selection dynamically filters Beneficiary dropdown options
  - All fields remain as interactive form elements until saved
- **Save Action**: User clicks the `floppy disk save` icon to persist the new payment record
- **Post-Save State**: After successful save, the row transforms from editable form fields to read-only labels with `pen` (edit) and `trash` (delete) icons

#### 5.2.2 Edit payment workflow

- **Edit Trigger**: User clicks the `pen` (edit) icon on any existing payment row
- **Edit Mode**: The selected row transforms from read-only labels back to interactive form fields:
  - Date Paid: Date picker with current value pre-selected
  - Amount Paid: Numeric input with current amount pre-filled
  - Beneficiary Type: Dropdown with current type pre-selected
  - Beneficiary: Filtered dropdown with current beneficiary pre-selected
  - Actions: Shows `floppy disk save` icon and `cancel/undo` icon
- **Save Changes**: User clicks the `floppy disk save` icon to update the record
- **Cancel Changes**: User can click `cancel/undo` icon to revert to original values
- **Post-Save State**: Row returns to read-only label format with `pen` and `trash` icons

#### 5.2.3 Delete payment workflow

- **Delete Trigger**: User clicks the `trash` (delete) icon on any existing payment row
- **Confirmation**: System shows confirmation dialog to prevent accidental deletion
- **Delete Action**: Upon confirmation, the row is immediately removed from the table
- **Feedback**: System provides visual feedback (toast notification) confirming successful deletion

### 5.3 Advanced features & edge cases

#### 5.3.1 Validation Rules

- **Date Validation**: Prevent adding/editing payments with future dates (date must be <= today)
- **Amount Validation**: Prevent negative or zero payment amounts (must be positive with max 2 decimal places)
- **Beneficiary Validation**: Ensure beneficiary selection matches the chosen beneficiary type
- **Required Fields**: All fields (Date, Amount, Beneficiary Type, Beneficiary) are mandatory

#### 5.3.2 UI States & Feedback

- **Empty State**: When no payments exist, show empty table with helpful message "No payments recorded for this Zakat year"
- **Loading States**: Show loading indicators during save/delete operations
- **Error Handling**: Display inline error messages for validation failures
- **Success Feedback**: Show toast notifications for successful operations
- **Disabled States**: Disable actions when no Zakat year is selected

#### 5.3.3 Responsive Design

- **Mobile Optimization**: Table adapts to smaller screens with appropriate scrolling
- **Touch Interactions**: Icons and buttons sized appropriately for touch devices
- **Accessibility**: Proper ARIA labels and keyboard navigation support

### 5.4 UI/UX highlights

#### 5.4.1 Visual Design

- **Icon-Based Actions**: Use universally recognized icons (`+`, `floppy disk`, `pen`, `trash`) instead of text buttons
- **State Transitions**: Smooth transitions between read-only and edit modes
- **Visual Hierarchy**: Clear distinction between editable fields and read-only data
- **Consistent Styling**: Follow existing application design patterns and color scheme

#### 5.4.2 Interaction Patterns

- **Inline Editing**: All editing happens within the table row (no separate forms or modals)
- **Progressive Disclosure**: Show relevant actions based on current state (save vs edit/delete)
- **Immediate Feedback**: Real-time validation and instant visual feedback
- **Keyboard Support**: Full keyboard navigation for accessibility

#### 5.4.3 Data Display

- **Table Format**: Clean, organized table layout with proper column alignment
- **Dynamic Filtering**: Beneficiary dropdown automatically filters based on type selection
- **Date Formatting**: Consistent date display format across the application
- **Currency Display**: Proper formatting for monetary amounts

## 6. Narrative

A logged-in user visits the Zakat Payments page and selects their desired Zakat year. They see their existing payment records displayed as a clean, organized table. To add a new payment, they click the `+` icon which immediately creates a new row with interactive form fields. They use the calendar picker to select a date, enter the payment amount, choose between Individual or Business beneficiary type, and select the specific beneficiary from the filtered dropdown. After clicking the floppy disk save icon, their new payment appears as a read-only row with edit and delete options. If they need to modify an existing payment, they click the pen icon to switch that row back to edit mode, make their changes, and save again. The delete option provides a safety confirmation before removing any records. Throughout this process, the system provides immediate feedback and validation to ensure data accuracy.

## 6. Narrative

A logged-in user visits the Zakat Payments page, selects the relevant year, and can add, edit, or delete payment records. Each payment entry includes the date paid, amount, beneficiary type, and beneficiary. The user receives immediate feedback for all actions, ensuring their records are accurate and up to date. The system enforces validation rules to prevent errors and maintains a clear, user-friendly interface.

## 7. Success metrics

### 7.1 User-centric metrics

- Number of users adding or editing payment rows.
- Reduction in user-reported errors or confusion.
- User satisfaction with payment management features.

### 7.2 Business metrics

- Increase in user retention and engagement on the Zakat Payments page.
- Growth in the number of authenticated users managing Zakat records.

### 7.3 Technical metrics

- Error rate for CRUD operations.
- Average response time for payment row actions.
- Uptime and reliability of the Zakat Payments feature.

## 8. Technical considerations

### 8.1 Integration points

- User authentication system.
- Backend API for Zakat payment CRUD operations.
- Year filter component.

### 8.2 Data storage & privacy

- Store payment rows in a secure, user-scoped database table.
- Ensure only the logged-in user can access and modify their own records.
- Comply with data privacy best practices.

### 8.3 Scalability & performance

- Efficiently load and update payment rows for the selected year.
- Support for large numbers of payment records per user.

### 8.4 Potential challenges

- Handling concurrent edits or deletions.
- Ensuring robust validation and error handling.
- Maintaining a seamless user experience across devices.

## 9. Milestones & sequencing

### 9.1 Project estimate

- Small: 1-2 weeks

### 9.2 Team size & composition

- 1-2 developers, 1 designer (optional), 1 QA

### 9.3 Implementation Status & Phases

- **Phase 1**: ✅ **COMPLETED** - Implement backend CRUD endpoints and data model
  - ✅ API endpoints with comprehensive server actions
  - ✅ Database schema validation with Zod schemas
  - ✅ Server actions with authentication and error handling
  - **Status**: All CRUD operations functional with proper validation

- **Phase 2**: ✅ **COMPLETED** - Build enhanced frontend UI with inline editing
  - ✅ Icon-based actions (`+` square icon, floppy disk, pen, trash icons)
  - ✅ Inline table editing with seamless form field transformations
  - ✅ Calendar date picker integration with future date prevention
  - ✅ Dynamic beneficiary filtering (Individual/Business entities)
  - ✅ Smooth state transitions (read-only ↔ edit mode)
  - ✅ Toast notifications and comprehensive loading states
  - **Status**: Complete inline editing workflow implemented

- **Phase 3**: ✅ **COMPLETED** - Integrate authentication and user scoping
  - ✅ Authentication checks in all server actions
  - ✅ User-specific data filtering for all operations
  - ✅ Session validation with proper error handling
  - **Status**: All data properly scoped to authenticated users

- **Phase 4**: ✅ **COMPLETED** - Advanced UX polish and accessibility
  - ✅ Responsive design with touch-friendly interactions
  - ✅ Full keyboard navigation support with ARIA labels
  - ✅ Empty state messaging for better user guidance
  - ✅ Comprehensive error handling and user feedback
  - ✅ Cross-device compatibility (mobile/desktop)
  - **Status**: Production-ready UX with accessibility compliance

- **Phase 5**: ✅ **COMPLETED** - Testing, validation, and integration
  - ✅ End-to-end workflow testing (add/edit/delete operations)
  - ✅ Edge case handling (temporary rows, cancellation, network errors)
  - ✅ TypeScript compilation validation (zero errors)
  - ✅ Performance optimization with proper state management
  - ✅ Integration with existing application architecture
  - **Status**: Ready for production deployment

### 🎯 **IMPLEMENTATION COMPLETE**

**Development Server**: http://localhost:3001  
**Feature Branch**: `feature/zakat-payment-row-management`  
**Total Implementation Time**: 5 days (as estimated)  
**Status**: ✅ All acceptance criteria met, ready for user testing

## 10. User stories

### 10.1. Add Zakat payment row

- **ID**: GH-001
- **Description**: As an authenticated user, I want to add a new Zakat payment row by clicking a `+` icon within a square button and filling in interactive form fields within the table, so I can efficiently record my payments with a streamlined workflow.
- **Acceptance criteria**:
  - User clicks a `+` icon inside a square button (not circular) to add a new payment row
  - New row appears immediately with interactive form fields:
    - Date Paid: Calendar picker widget (similar to `/settings/calendar` page)
    - Amount Paid: Numeric input field (initially empty)
    - Beneficiary Type: Dropdown with "Individual" and "Business" options
    - Beneficiary: Dynamically filtered dropdown based on selected type
    - Actions: Shows floppy disk save icon
  - All fields are editable form elements until saved
  - Amount must be positive with max 2 decimal places
  - Date cannot be in the future
  - Beneficiary selection must match the chosen type
  - User clicks floppy disk save icon to persist the record
  - After successful save, row transforms to read-only labels with pen and trash icons
  - User receives toast notification confirming successful addition

### 10.2. Edit Zakat payment row

- **ID**: GH-002
- **Description**: As an authenticated user, I want to edit an existing Zakat payment row by clicking a pen icon to switch the row to edit mode, so I can easily correct or update my payment records inline.
- **Acceptance criteria**:
  - User clicks pen icon on any existing payment row
  - Row transforms from read-only labels to interactive form fields:
    - Date Paid: Calendar picker with current value pre-selected
    - Amount Paid: Numeric input with current amount pre-filled
    - Beneficiary Type: Dropdown with current type pre-selected
    - Beneficiary: Filtered dropdown with current beneficiary pre-selected
    - Actions: Shows floppy disk save icon and cancel/undo icon
  - User can modify any field values
  - All validation rules from add apply (positive amount, non-future date, matching beneficiary type)
  - User clicks floppy disk save icon to update the record
  - User can click cancel/undo icon to revert changes without saving
  - After successful save, row returns to read-only format with pen and trash icons
  - User receives toast notification confirming successful update

### 10.3. Delete Zakat payment row

- **ID**: GH-003
- **Description**: As an authenticated user, I want to delete a Zakat payment row by clicking a trash icon with confirmation, so I can remove incorrect or duplicate entries safely.
- **Acceptance criteria**:
  - User clicks trash icon on any existing payment row
  - System displays confirmation dialog to prevent accidental deletion
  - Dialog includes payment details (date, amount) for user verification
  - User can confirm or cancel the deletion
  - Upon confirmation, row is immediately removed from the table
  - User receives toast notification confirming successful deletion
  - Cancelled deletions leave the row unchanged

### 10.4. Authentication and user scoping

- **ID**: GH-004
- **Description**: As a user, I want to ensure that only I can view and modify my Zakat payment rows with proper security measures.
- **Acceptance criteria**:
  - Only authenticated users can access the Zakat Payments page
  - Users can only view and modify their own payment rows
  - Unauthenticated users are redirected to login or shown an error
  - All server operations validate user session and ownership
  - Individual and Business beneficiaries are filtered by user ownership

### 10.5. Enhanced UI/UX interactions

- **ID**: GH-005
- **Description**: As a user, I want a polished and intuitive interface with proper visual states and feedback, so I have a seamless experience managing my Zakat payments.
- **Acceptance criteria**:
  - Empty table shows helpful message: "No payments recorded for this Zakat year"
  - Loading indicators appear during save/delete operations
  - All actions are disabled when no Zakat year is selected
  - Icons are universally recognizable (`+`, floppy disk, pen, trash)
  - Smooth visual transitions between read-only and edit modes
  - Proper responsive design for mobile and desktop devices
  - Full keyboard navigation support for accessibility
  - Inline validation with clear error messages
  - Consistent styling following application design patterns
