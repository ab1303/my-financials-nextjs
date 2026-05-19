# lld.md

## Phase Map
| Phase                        | Files Changed                                         | Description                                              |
|------------------------------|------------------------------------------------------|----------------------------------------------------------|
| UI Redesign                  | form.tsx, page.tsx                                   | Compact inline-add, table/list, remove address fields     |
| Controller/Schema Update     | bank.controller.ts, bank.schema.ts, businessTypes.ts | Remove address logic/validation from bank flows          |

---

### Phase: UI Redesign

#### TypeScript Interfaces
```typescript
// Bank Institution (UI)
export interface BankInstitution {
  id: string;
  name: string;
}
```

#### TDD Test Cases
| Test                                 | Type    | Verifies                                  |
|--------------------------------------|---------|--------------------------------------------|
| Renders only name field              | UI      | No address fields present                  |
| Adds bank via inline form            | UI      | Bank appears in list after add             |
| Table updates after add/delete       | UI      | List reflects changes immediately          |

---

### Phase: Controller/Schema Update

#### Zod Schema
```typescript
import { z } from 'zod';

export const bankInstitutionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});
```

#### Function Signatures
```typescript
// Controller
async function createBankInstitution(input: { name: string }): Promise<BankInstitution>;
```

#### TDD Test Cases
| Test                                 | Type    | Verifies                                  |
|--------------------------------------|---------|--------------------------------------------|
| Rejects missing name                 | API     | Validation error if name is empty          |
| Accepts valid name                   | API     | Bank is created with valid name            |
| No address logic in controller       | API     | Address fields ignored/absent              |

---

## Migration Notes
- No Prisma migration required (address columns remain for philanthropy)

## Integration Points & Edge Cases
- Only global/admin-managed banks (userId = null) affected
- User-specific institution flows must not be changed
- Table/list must update reactively after add/delete
