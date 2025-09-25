# Form Implementation Patterns and Best Practices

## Overview

This instruction file contains patterns and best practices for implementing entity management forms and feature interfaces across the application. Based on successful implementations of Business Entity Management and Bank Details forms, these patterns ensure consistency and maintainability.

## Core Principles

### Layout Consistency

- **Always maintain visual consistency with existing forms**: Use the same layout patterns as Bank Details, Business Entity Management, and other management forms
- **Use gray background layouts**: Apply `layoutStyles.grayBackground` from theme utilities for consistent page backgrounds
- **Container width constraints**: Use `max-w-3xl` or similar constraints to match existing form widths
- **Card-based form design**: Wrap form content in Card components for consistent styling

### Form Architecture Patterns

#### Client Component Structure

- **Use Client Components for forms**: All entity management forms should be Client Components with `"use client"` directive
- **Import management**: Always import required dependencies at the top:
  ```typescript
  import clsx from 'clsx';
  import { z } from 'zod';
  import { useId, useState } from 'react';
  import { FormProvider, useForm } from 'react-hook-form';
  import Select, { components } from 'react-select';
  import { toast } from 'react-toastify';
  import { TRPCError } from '@trpc/server';
  import { useQueryClient } from '@tanstack/react-query';
  ```

#### Type Definition Patterns

- **Define comprehensive TypeScript types**: Create detailed type definitions for entities (examples: Business, Bank, etc.):

  ```typescript
  // Example: Business Entity Type
  type BusinessType = {
    businessName: string;
    type: BusinessEnumType;
    address: {
      addressLine: string;
      street_address: string;
      suburb: string;
      postcode: string;
      state: string;
    };
  };

  // Example: Bank Entity Type
  type BankType = {
    bankName: string;
    accountNumber: string;
    routingNumber: string;
    address: AddressType;
  };
  ```

- **Option types for selects**: Define option types for react-select components:

  ```typescript
  // Generic pattern for any entity
  type EntityOptionType<T> = {
    value: T;
    label: string;
    id: string;
  };

  // Specific implementations
  type BusinessOptionType = EntityOptionType<BusinessType>;
  type BankOptionType = EntityOptionType<BankType>;
  ```

### Enum Integration Patterns

#### Entity Type/Category Fields

- **Always include type/category fields**: Entities should have type classification using enums when applicable
- **Import from centralized location**: Import enums from `@/types/enum`:

  ```typescript
  // Examples of different entity enums
  import {
    BusinessEnumType,
    BankAccountType,
    EntityStatusType,
  } from '@/types/enum';
  ```

- **Render as dropdown**: Display enum values as select dropdowns with proper styling:
  ```tsx
  <select
    className={clsx(
      'block w-full max-w-md px-3 py-2 text-sm border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500',
      {
        'border-red-500 focus:ring-red-500 focus:border-red-500': errors.type,
      },
    )}
    {...register('type', { required: true })}
  >
    {Object.values(YourEnumType).map((val) => (
      <option key={val} value={val}>
        {val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()}
      </option>
    ))}
  </select>
  ```

### CRUD Operation Patterns

#### Form State Management

- **Use react-hook-form**: Implement forms with react-hook-form for validation and state management
- **Default values structure**: Always provide complete default values:

  ```typescript
  // Generic pattern for any entity form
  const formMethods = useForm<EntityType>({
    mode: 'onBlur',
    defaultValues: {
      entityName: '',
      type: DefaultEnumValue, // Provide appropriate default enum value
      // Include all required fields with empty/default values
      address: {
        addressLine: '',
        street_address: '',
        suburb: '',
        postcode: '',
        state: '',
      },
    },
  });

  // Example: Business form defaults
  const formMethods = useForm<BusinessType>({
    mode: 'onBlur',
    defaultValues: {
      businessName: '',
      type: BusinessEnumType.BANK,
      address: {
        /* address fields */
      },
    },
  });
  ```

#### Selection and Editing

- **Implement selection dropdown**: Use react-select for entity selection with custom option components
- **Edit state management**: Use useState for tracking selected entities:

  ```typescript
  // Generic pattern for any entity selection
  const [selectedEntity, setSelectedEntity] = useState<
    SingleValue<EntityOptionType<YourEntityType>> | undefined
  >();

  // Specific examples
  const [selectedBusiness, setSelectedBusiness] = useState<
    SingleValue<BusinessOptionType> | undefined
  >();

  const [selectedBank, setSelectedBank] = useState<
    SingleValue<BankOptionType> | undefined
  >();
  ```

- **Form population on selection**: Use useEffect to populate form when selection changes:
  ```typescript
  useEffect(() => {
    if (selectedEntity?.value) {
      const entity = selectedEntity.value;
      // Populate form fields based on entity structure
      formFieldSetValue('entityName', entity.entityName);
      formFieldSetValue('type', entity.type);
      // Populate other fields as needed...
    }
  }, [selectedEntity, formFieldSetValue]);
  ```

#### Delete Functionality

- **Implement delete icons**: Create reusable delete icon components:

  ```typescript
  function DeleteIcon(props: DeleteIconProps) {
    return (
      <div
        className='flex items-center hover:cursor-pointer hover:text-orange-700'
        onClick={props.onClick}
      >
        <MdOutlineDeleteOutline className='text-xl' />
      </div>
    );
  }
  ```

- **Custom option components**: Use react-select custom components for delete functionality:

  ```typescript
  // Generic pattern for any entity options with delete
  const Option = (props: OptionProps<EntityOptionType<YourEntityType>, false>) => (
    <components.Option {...props}>
      <div className='flex w-full items-center justify-between'>
        <span>{props.data.label}</span>
        <DeleteIcon onClick={(e) => handleDelete(e, props.data.id)} />
      </div>
    </components.Option>
  );

  // Example: Business options
  const Option = (props: OptionProps<BusinessOptionType, false>) => (
    <components.Option {...props}>
      <div className='flex w-full items-center justify-between'>
        <span>{props.data.label}</span>
        <DeleteIcon onClick={(e) => handleDelete(e, props.data.id)} />
      </div>
    </components.Option>
  );
  ```

### tRPC Integration Patterns

#### Query and Mutation Setup

- **Use proper query patterns**: Implement tRPC queries for data fetching:

  ```typescript
  // Generic pattern for entity queries and mutations
  const getEntitiesQuery = trpc.entityRouter.getAllEntities.useQuery();
  const saveEntityMutation = trpc.entityRouter.saveEntityDetails.useMutation({
    onError(error: unknown) {
      if (error instanceof TRPCError) {
        toast.error(error.message);
      }
    },
    onSuccess() {
      queryClient.refetchQueries({
        queryKey: [['entityRouter', 'getAllEntities']],
      });
      toast.success('Entity details saved!');
    },
  });

  // Examples for specific entities
  const getBusinessesQuery = trpc.business.getAllBusinesses.useQuery();
  const getBanksQuery = trpc.bank.getAllBanks.useQuery();
  ```

#### Data Transformation

- **Transform API data for selects**: Convert API responses to option format:

  ```typescript
  // Generic pattern for transforming entity data
  const entityOptions: EntityOptionType<YourEntityType>[] =
    entities?.map((entity) => ({
      value: {
        ...entity,
        type: (entity.type as YourEnumType) || DefaultEnumValue,
      },
      label: entity.displayName, // Use appropriate display field
      id: entity.id!,
    })) || [];

  // Examples for specific entities
  const businessOptions: BusinessOptionType[] =
    businesses?.map((o) => ({
      value: {
        ...o,
        type: (o.type as BusinessEnumType) || BusinessEnumType.BANK,
      },
      label: o.businessName,
      id: o.id!,
    })) || [];

  const bankOptions: BankOptionType[] =
    banks?.map((bank) => ({
      value: bank,
      label: bank.bankName,
      id: bank.id!,
    })) || [];
  ```

### Address Component Integration

#### Reusable Address Components

- **Use AddressComponent**: Integrate existing AddressComponent for address fields when applicable:

  ```tsx
  // Generic pattern for entities with addresses
  <AddressComponent<YourEntityType>
    basePropertyName='address'
    address={selectedEntity?.value.address}
    addressFields={{
      addressLine: 'addressLine',
      street_address: 'street_address',
      suburb: 'suburb',
      postcode: 'postcode',
      state: 'state',
    }}
  />

  // Example: Business entity
  <AddressComponent<BusinessType>
    basePropertyName='address'
    address={selectedBusiness?.value.address}
    addressFields={{
      addressLine: 'addressLine',
      street_address: 'street_address',
      suburb: 'suburb',
      postcode: 'postcode',
      state: 'state',
    }}
  />
  ```

### File Structure and Naming

#### File Organization

- **Use feature-based structure**: Organize entity forms in feature directories (`/business`, `/bank`, `/settings`, etc.)
- **Consistent naming**: Use descriptive filenames (`form.tsx`, not generic names)
- **Import path consistency**: Ensure import paths match actual filenames

#### Page Structure

- **Minimal page components**: Keep page.tsx files simple and focused:

  ```tsx
  // Generic pattern for entity pages
  import EntityForm from './form';

  export default function Page() {
    return (
      <div className='mx-auto max-w-3xl'>
        <EntityForm />
      </div>
    );
  }

  // Examples
  import BusinessForm from './form'; // Business page
  import BankForm from './form'; // Bank page
  ```

- **Layout consistency**: Use layout.tsx for consistent background styling:

  ```tsx
  import { layoutStyles } from '@/styles/theme';

  export default function Layout({ children }: { children: React.ReactNode }) {
    return <div className={layoutStyles.grayBackground}>{children}</div>;
  }
  ```

### Build and Development Practices

#### Package Management

- **Always use pnpm**: Use pnpm for all package management operations, never npm
- **Build verification**: Always run `pnpm run build` to verify changes before completion
- **Development testing**: Use `pnpm run dev` for development server testing

#### Error Handling

- **Import path verification**: Always verify import paths match actual filenames
- **Type safety**: Ensure all enum imports and type definitions are correct
- **Build error resolution**: Address all TypeScript and build errors before completion

### Validation and Schema Patterns

#### Zod Integration

- **Use zod for validation**: Implement zod schemas for form validation:
  ```typescript
  const postCodeSchema = z.coerce.number({
    required_error: 'Postcode is required',
    invalid_type_error: 'Postcode must be a number',
  });
  ```

#### Form Validation

- **Required field validation**: Mark essential fields as required
- **Error state styling**: Apply error styling conditionally based on form errors
- **User feedback**: Provide clear error messages and success notifications

### Backend Integration Requirements

#### Controller Updates

- **Handle type fields**: Ensure backend controllers process type/enum fields:

  ```typescript
  // Generic pattern for controllers
  // In entity.controller.ts
  type: input.type || DefaultEnumValue,

  // Examples for specific entities
  // In business.controller.ts
  type: input.type || BusinessEnumType.BANK,

  // In bank.controller.ts
  accountType: input.accountType || BankAccountType.CHECKING,
  ```

#### Schema Updates

- **Include type validation**: Update schemas to include type field validation:

  ```typescript
  // Generic pattern for schemas
  // In entity.schema.ts
  type: z.nativeEnum(YourEnumType).optional(),

  // Examples for specific entities
  // In business.schema.ts
  type: z.nativeEnum(BusinessEnumType).optional(),

  // In bank.schema.ts
  accountType: z.nativeEnum(BankAccountType).optional(),
  ```

## Implementation Checklist

When implementing entity management forms, ensure:

- [ ] Layout matches existing forms (gray background, proper width constraints)
- [ ] Form is a Client Component with proper imports
- [ ] TypeScript types are comprehensive and include type/category fields when applicable
- [ ] Enum integration is implemented with dropdown selection where relevant
- [ ] CRUD operations include create, read, update, and delete functionality
- [ ] tRPC integration follows established patterns
- [ ] Address component is properly integrated when entities have addresses
- [ ] File structure and naming is consistent with project conventions
- [ ] pnpm is used for all build operations
- [ ] All import paths are verified and correct
- [ ] Form validation is implemented with proper error handling
- [ ] Backend controllers and schemas are updated to handle new fields

## Reference Implementations

### Successful Examples to Reference

- **Business Entity Management**: `src/app/(authorized)/relation/business/`
  - Complete CRUD with type classification
  - Address integration
  - React-select with custom options
  - Delete functionality

- **Bank Details Management**: `src/app/(authorized)/settings/banks/`
  - Form layout and styling patterns
  - Consistent page structure
  - Error handling and validation

### Patterns to Follow

- Use these implementations as templates for new entity forms
- Maintain the same visual and functional consistency
- Adapt the patterns to fit specific entity requirements
- Keep the same file structure and naming conventions

## Common Pitfalls to Avoid

1. **Import path mismatches**: Always verify import paths match actual filenames
2. **Missing enum defaults**: Provide default enum values in form initialization
3. **Incomplete type definitions**: Ensure all fields are included in TypeScript types
4. **Layout inconsistency**: Don't deviate from established layout patterns
5. **npm usage**: Never use npm, always use pnpm for package management
6. **Missing validation**: Always implement proper form validation and error handling
7. **Incomplete CRUD**: Ensure all CRUD operations are implemented and tested
