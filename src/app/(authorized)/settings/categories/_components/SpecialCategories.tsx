'use client';

import { trpc } from '@/server/trpc/client';
import { Badge } from '@/components/ui/badge';

export default function SpecialCategories() {
  const { data: categories = [] } = trpc.specialCategory.getAll.useQuery();

  if (!categories.length) {
    return <p className='text-sm text-muted-foreground'>No special categories available.</p>;
  }

  return (
    <div className='space-y-3'>
      {categories.map((category) => (
        <div
          key={category.id}
          className='flex items-start justify-between rounded-lg border border-border bg-card p-4 select-none cursor-default'
        >
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              <h3 className='font-medium text-foreground'>{category.name}</h3>
              {!category.isActive && (
                <Badge variant='secondary' className='text-xs'>
                  Inactive
                </Badge>
              )}
              {!category.isEditable && (
                <Badge variant='outline' className='text-xs'>
                  System
                </Badge>
              )}
              {category.color && (
                <div
                  className='h-3 w-3 rounded-full border border-border'
                  style={{ backgroundColor: category.color }}
                  title={`Color: ${category.color}`}
                  aria-hidden="true"
                />
              )}
            </div>
            <p className='mt-1 text-sm text-muted-foreground'>{category.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
