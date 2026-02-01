# PRD: Donations Management

## 1. Product overview

- **Add donation record** (Priority: High)
  - Users can add new donation entries for the selected fiscal year.
  - Required fields: date paid, amount paid, beneficiary type, beneficiary, tax category.
  - Validations:
    - Amount must be positive, with up to two decimal places (e.g., 250.75).
    - Date must be in ISO 8601 format (YYYY-MM-DD), cannot be in the future.
    - Date must fall within the selected fiscal year period.
    - No amount limits - system is for record-keeping, not payment processing..1 Document title and version

- PRD: Donations Management
- Version: 1.0

### 1.2 Product summary

This feature enables authenticated users to track and record their charitable donations for tax reporting purposes. Users can record donation entries for a selected fiscal year, categorize donations by beneficiary type (Individual or Business entities) and tax category, and maintain detailed records for tax filing compliance. The system provides a centralized view of annual donation totals and individual donation records with comprehensive CRUD operations.

This is a record-keeping system, not a payment processing system - users manually enter donations they have already made through other means. The feature follows the same architectural patterns as the existing Zakat Payment management system but focuses specifically on charitable giving and tax deduction tracking for fiscal year periods.

## 2. Goals

### 2.1 Business goals

- Provide comprehensive donation tracking for tax compliance and reporting.
- Enhance user engagement by offering practical financial management tools.
- Support users in maintaining accurate charitable giving records.
- Streamline tax preparation by organizing donation data by fiscal year.

### 2.2 User goals

- Easily track all charitable donations for tax deduction purposes.
- Organize donations by fiscal year for streamlined tax filing.
- Maintain detailed records of donation beneficiaries and amounts.
- Generate accurate donation totals for specific tax periods.

### 2.3 Non-goals

- Tax calculation or advice features (purely record-keeping).
- Payment processing or financial transactions (system is for tracking only).
- Integration with external tax software or government systems.
- Management of donations for years other than the selected fiscal year.
- Support for unauthenticated or guest users.
- Automatic donation import from bank statements or receipts.
- Amount limits or payment validation (system tracks already-made donations).

## 3. User personas

### 3.1 Key user types

- Authenticated individual users who make charitable donations

### 3.2 Basic persona details

- **Tax-conscious donor**: An individual who makes regular charitable donations and needs organized records for annual tax filing and deduction claims.

### 3.3 Role-based access

- **Authenticated user**: Can add, edit, delete, and view their own donation records for the selected fiscal year.

## 4. Functional requirements

- **Add donation record** (Priority: High)
  - Users can add new donation entries for the selected fiscal year.
  - Required fields: date paid, amount paid, beneficiary type, beneficiary.
  - Validations:
    - Amount must be positive with up to two decimal places (e.g., 250.75).
    - Date must be in ISO 8601 format (YYYY-MM-DD), cannot be in the future.
    - Date must fall within the selected fiscal year period.
- **Edit donation record** (Priority: High)
  - Users can modify any donation record for the selected fiscal year.
  - All validations from add operation apply.
- **Delete donation record** (Priority: High)
  - Users can remove donation records with confirmation prompt.
- **Fiscal year filtering** (Priority: Medium)
  - CRUD operations affect only the currently selected fiscal year.
  - Automatic calculation of "Total Paid" based on filtered records.
- **Authentication** (Priority: High)
  - Only authenticated users can access and modify their own donation records.

## 5. User experience

### 5.1 Entry points & first-time user flow

- User logs in and clicks "Donations" from the CashFlow section in the left navigation menu.
- User lands on the Donations page at `/cashflow/donations`.
- User selects a fiscal year from the dropdown filter.
- System displays existing donation records (if any) for the selected fiscal year.
- Empty state shows table headers: Date Paid, Amount Paid, Beneficiary Type, Beneficiary, Tax Category, Actions.

### 5.2 Core experience

#### 5.2.1 Page structure and fiscal year selection

- **Page Header**: "Donations" title with clear navigation breadcrumb.
- **Fiscal Year Selection**: Dropdown with available fiscal years from calendar system.
- **Total Paid Display**: Non-editable field showing sum of all donations for selected fiscal year.
- **Donation Records Section**: Table displaying individual donation entries.

#### 5.2.2 Add donation workflow

- **Add Donation Trigger**: User clicks `+` icon button (square shape) above the donations table.
- **New Row Creation**: System immediately adds editable row at bottom of table with:
  - Date Paid: Interactive date picker (calendar widget) defaulting to current date.
  - Amount Paid: Numeric input field (initially empty, user must enter amount).
  - Beneficiary Type: Dropdown with "Individual" and "Business" options.
  - Beneficiary: Filtered dropdown based on selected Beneficiary Type (linked to user's existing Individual/Business entities).
  - Tax Category: Dropdown with tax-relevant donation categories.
  - Actions: Shows floppy disk save icon for persisting the record.
- **Field Validation**:
  - Date picker prevents future dates and dates outside selected fiscal year.
  - Amount field accepts positive decimal values with max 2 decimal places (no upper limits).
  - Beneficiary Type selection dynamically filters Beneficiary dropdown to user's entities.
  - Tax Category selection required for proper tax record categorization.
  - All fields required before save operation can complete.
- **Save Action**: User clicks floppy disk save icon to create donation record.
- **Post-Save State**: Row transforms from editable form fields to read-only labels with pen (edit) and trash (delete) icons.

#### 5.2.3 Edit donation workflow

- **Edit Trigger**: User clicks pen (edit) icon on any existing donation row.
- **Edit Mode**: Selected row transforms to interactive form fields:
  - Date Paid: Date picker with current value pre-selected.
  - Amount Paid: Numeric input with current amount pre-filled.
  - Beneficiary Type: Dropdown with current type pre-selected.
  - Beneficiary: Filtered dropdown with current beneficiary pre-selected.
  - Tax Category: Dropdown with current category pre-selected.
  - Actions: Shows floppy disk save icon and cancel/undo icon.
- **Save Changes**: User clicks floppy disk save icon to update record.
- **Cancel Changes**: User clicks cancel/undo icon to revert to original values.
- **Post-Save State**: Row returns to read-only format with pen and trash icons.

#### 5.2.4 Delete donation workflow

- **Delete Trigger**: User clicks trash (delete) icon on any existing donation row.
- **Confirmation Dialog**: System displays confirmation prompt to prevent accidental deletion.
- **Delete Action**: Upon confirmation, row is immediately removed from table.
- **Total Update**: "Total Paid" field automatically recalculates without page refresh.
- **Success Feedback**: Toast notification confirms successful deletion.

### 5.3 Advanced features & edge cases

#### 5.3.1 Validation and data integrity

- **Date Validation**: Prevent donations with dates outside selected fiscal year period.
- **Amount Validation**: Reject negative, zero, or invalid monetary amounts (no upper limits).
- **Beneficiary Validation**: Ensure beneficiary selection matches chosen beneficiary type and belongs to authenticated user.
- **Tax Category Validation**: Ensure valid tax category is selected for proper record categorization.
- **Required Fields**: All fields (Date, Amount, Beneficiary Type, Beneficiary, Tax Category) mandatory.
- **Fiscal Year Constraint**: Donations can only be added to existing fiscal years.

#### 5.3.2 User interface states

- **Empty State**: Show helpful message "No donations recorded for this fiscal year" when table is empty.
- **Loading States**: Display spinners during save/delete operations.
- **Error Handling**: Show inline error messages for validation failures.
- **Success Feedback**: Toast notifications for successful operations.
- **Disabled States**: Disable actions when no fiscal year is selected.

#### 5.3.3 Performance and accessibility

- **Responsive Design**: Table adapts to mobile screens with horizontal scrolling.
- **Touch Optimization**: Appropriately sized buttons and icons for mobile devices.
- **Keyboard Navigation**: Full keyboard accessibility with proper tab order.
- **Screen Reader Support**: ARIA labels and semantic HTML structure.

### 5.4 UI/UX highlights

#### 5.4.1 Visual design consistency

- **Icon-Based Actions**: Universal icons (`+`, floppy disk, pen, trash) for intuitive interaction.
- **State Transitions**: Smooth animations between read-only and edit modes.
- **Visual Hierarchy**: Clear distinction between form fields and display data.
- **Design System Adherence**: Consistent with existing application styling and patterns.

#### 5.4.2 Interaction patterns

- **Inline Editing**: All editing occurs within table rows (no separate forms or modals).
- **Progressive Disclosure**: Show relevant actions based on current row state.
- **Immediate Feedback**: Real-time validation and instant visual updates.
- **Optimistic Updates**: UI updates immediately with server confirmation following.

#### 5.4.3 Data presentation

- **Tabular Layout**: Clean, organized table with proper column alignment and sorting.
- **Dynamic Filtering**: Beneficiary dropdown automatically filters based on type selection.
- **Consistent Formatting**: Standardized date and currency display formats.
- **Real-time Totals**: "Total Paid" updates automatically as records are modified.

## 6. Narrative

A logged-in user navigates to the Donations page from the CashFlow section and selects their desired fiscal year to begin tracking charitable donations for tax purposes. The system displays their existing donation records in a clean table format with an automatically calculated total. To record a donation they have already made, they click the `+` icon which creates an interactive row with form fields. They select the donation date using the calendar picker (ensuring it falls within the fiscal year), enter the donation amount, choose between Individual or Business beneficiary type, select the specific recipient from their existing entities, and choose the appropriate tax category. After clicking the floppy disk save icon, their donation record appears as a read-only row with edit and delete options, while the total paid amount updates automatically. For existing donations, they can click the pen icon to modify details or the trash icon to remove entries with confirmation. Throughout this process, the system provides immediate validation feedback and maintains accurate running totals for tax reporting purposes.

## 7. Success metrics

### 7.1 User-centric metrics

- Number of users actively recording donation data.
- Average number of donation records per user per fiscal year.
- User satisfaction scores for donation tracking functionality.
- Task completion rate for donation CRUD operations.

### 7.2 Business metrics

- Increase in user engagement and retention on financial management features.
- Growth in authenticated user base utilizing comprehensive financial tracking.
- Reduced user support requests related to donation record management.

### 7.3 Technical metrics

- Error rate for donation CRUD operations (target: <1%).
- Average response time for donation record actions (target: <500ms).
- System uptime and reliability for donations feature (target: 99.9%).
- Database query performance for donation aggregations.

## 8. Technical considerations

### 8.1 Integration points

- NextAuth user authentication and session management system.
- Existing fiscal year calendar system (CalendarEnumType.FISCAL).
- Individual and Business entity management for beneficiary selection.
- Server Actions architecture for type-safe data mutations.

### 8.2 Data storage & privacy

- New Donation and DonationPayment database models with proper user scoping.
- Secure storage with user-specific data isolation and access controls.
- Compliance with data privacy regulations and secure data handling practices.
- Database migrations for new donation-related tables and relationships.

### 8.3 Scalability & performance

- Efficient database queries with proper indexing for fiscal year filtering.
- Optimized aggregation calculations for donation totals.
- Support for large numbers of donation records per user.
- Pagination and virtualization for users with extensive donation histories.

### 8.4 Potential challenges

- Database schema design for donation models with proper foreign key relationships.
- Handling concurrent edits to donation records from multiple sessions.
- Ensuring fiscal year date validation and boundary constraints.
- Maintaining consistent UI performance with real-time total calculations.

## 9. Milestones & sequencing

### 9.1 Project estimate

- Medium: 1-2 weeks

### 9.2 Team size & composition

- 1-2 developers, 1 designer (optional), 1 QA

### 9.3 Suggested phases

- **Phase 1**: Database schema and model implementation (3-4 days)
  - Create Donation and DonationPayment models in schema.prisma
  - Implement database migrations for new donation tables
  - Develop donation service layer with CRUD operations
  - Create TypeScript models and validation schemas

- **Phase 2**: Backend API and server actions (2-3 days)
  - Implement donation controller handlers for data operations
  - Create server actions for add, edit, delete donation records
  - Implement fiscal year integration and validation logic
  - Add comprehensive error handling and authentication checks

- **Phase 3**: Frontend UI components and table implementation (3-4 days)
  - Create main donations page with fiscal year selection
  - Implement donation table with inline editing functionality
  - Build state management with React Context and useReducer
  - Add date picker integration and form validation

- **Phase 4**: Testing, polish, and integration (2-3 days)
  - End-to-end testing of all CRUD operations
  - UI/UX polish with loading states and error handling
  - Accessibility testing and keyboard navigation verification
  - Performance optimization and final integration testing

## 10. User stories

### 10.1. Add donation record

- **ID**: GH-001
- **Description**: As an authenticated user, I want to add a new donation record by clicking a `+` icon and filling in interactive form fields within the table, so I can efficiently track my charitable giving for tax purposes.
- **Acceptance criteria**:
  - User clicks `+` icon within a square button to add new donation row
  - New row appears with interactive form fields:
    - Date Paid: Calendar picker widget with fiscal year date validation
    - Amount Paid: Numeric input field (positive decimal values with max 2 decimal places, no upper limits)
    - Beneficiary Type: Dropdown with "Individual" and "Business" options
    - Beneficiary: Filtered dropdown showing user's existing Individual/Business entities
    - Tax Category: Dropdown with tax-relevant donation categories
    - Actions: Shows floppy disk save icon
  - Date cannot be in the future or outside selected fiscal year period
  - Amount must be positive with maximum 2 decimal places (no upper limits - record-keeping only)
  - Beneficiary selection must match the chosen type and belong to authenticated user
  - Tax category must be selected for proper record categorization
  - User clicks floppy disk save icon to persist the record
  - After successful save, row transforms to read-only labels with pen and trash icons
  - "Total Paid" field updates automatically to include new donation
  - User receives toast notification confirming successful addition

### 10.2. Edit donation record

- **ID**: GH-002
- **Description**: As an authenticated user, I want to edit an existing donation record by clicking a pen icon to switch the row to edit mode, so I can correct or update my donation information.
- **Acceptance criteria**:
  - User clicks pen icon on any existing donation row
  - Row transforms from read-only labels to interactive form fields:
    - Date Paid: Calendar picker with current value pre-selected
    - Amount Paid: Numeric input with current amount pre-filled
    - Beneficiary Type: Dropdown with current type pre-selected
    - Beneficiary: Filtered dropdown with current beneficiary pre-selected
    - Tax Category: Dropdown with current category pre-selected
    - Actions: Shows floppy disk save icon and cancel/undo icon
  - All validation rules from add operation apply
  - User clicks floppy disk save icon to update the record
  - User can click cancel/undo icon to revert changes
  - After successful save, row returns to read-only format
  - "Total Paid" field recalculates automatically
  - User receives toast notification confirming successful update

### 10.3. Delete donation record

- **ID**: GH-003
- **Description**: As an authenticated user, I want to delete a donation record by clicking a trash icon with confirmation, so I can remove incorrect or duplicate entries safely.
- **Acceptance criteria**:
  - User clicks trash icon on any existing donation row
  - System displays confirmation dialog to prevent accidental deletion
  - Dialog includes donation details (date, amount, beneficiary) for verification
  - User can confirm deletion or cancel operation
  - Upon confirmation, row is immediately removed from table
  - "Total Paid" field recalculates automatically
  - User receives toast notification confirming successful deletion
  - Cancelled deletions leave the row unchanged

### 10.4. Fiscal year filtering and total calculation

- **ID**: GH-004
- **Description**: As an authenticated user, I want to select a fiscal year and see only donations for that period with an accurate total, so I can organize my charitable giving records for tax filing.
- **Acceptance criteria**:
  - User can select fiscal year from dropdown populated with existing fiscal calendar years
  - Only donation records within selected fiscal year period are displayed
  - "Total Paid" field shows sum of all donations for selected fiscal year
  - Total updates automatically when donations are added, edited, or deleted
  - CRUD operations affect only the currently selected fiscal year
  - Date validation prevents adding donations outside selected fiscal year period
  - Tax category selection required for all donation records
  - Empty state message appears when no donations exist for selected fiscal year
  - Fiscal year selection persists during user session

### 10.5. Authentication and user scoping

- **ID**: GH-005
- **Description**: As a user, I want to ensure that only I can view and modify my donation records with proper security measures.
- **Acceptance criteria**:
  - Only authenticated users can access the Donations page
  - Users can only view and modify their own donation records
  - All server actions validate user session before performing operations
  - Database queries filter donation records by authenticated user ID
  - Individual and Business beneficiaries are limited to user's existing entities
  - Beneficiary dropdowns only show entities belonging to authenticated user
  - Unauthenticated requests are rejected with appropriate error messages
  - Session expiration handles gracefully with proper error messaging

### 10.6. Enhanced UI/UX and accessibility

- **ID**: GH-006
- **Description**: As a user, I want a polished and accessible interface with proper visual states and feedback, so I have a seamless experience managing my donation records.
- **Acceptance criteria**:
  - Empty table shows helpful message: "No donations recorded for this fiscal year"
  - Table headers include: Date Paid, Amount Paid, Beneficiary Type, Beneficiary, Tax Category, Actions
  - Loading states display during save/delete operations
  - Inline error messages appear for validation failures
  - Toast notifications provide success/error feedback
  - Responsive design works on mobile and desktop devices
  - Full keyboard navigation support with proper tab order
  - ARIA labels and semantic HTML for screen reader accessibility
  - Consistent styling following application design patterns
  - Smooth transitions between read-only and edit modes
  - Touch-friendly button sizes for mobile devices
