'use client';
import React, { useState } from 'react';
import Card from '@/components/card/Card';
import { Label, TextInput } from '@/components/ui';

interface Business {
  id: string;
  name: string;
  addressLine?: string;
  streetAddress?: string;
  suburb?: string;
  postcode?: number | string;
  state?: string;
}

import { trpc } from '@/server/trpc/client';

const BusinessSelect: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {
    data: rawBusinesses = [],
    isLoading,
    error,
  } = trpc.business.getAllBusinesses.useQuery();
  // Map nulls to empty strings for UI compatibility
  const businesses: Business[] = rawBusinesses.map((b: any) => ({
    id: b.id,
    name: b.name ?? '',
    addressLine: b.addressLine ?? '',
    streetAddress: b.streetAddress ?? '',
    suburb: b.suburb ?? '',
    postcode: b.postcode === null || b.postcode === undefined ? '' : b.postcode,
    state: b.state ?? '',
  }));
  const selectedBusiness = businesses.find((b) => b.id === selectedId) || null;

  if (isLoading) {
    return <div>Loading businesses...</div>;
  }
  if (error) {
    return <div>Error loading businesses.</div>;
  }
  return (
    <div className='flex min-h-[60vh] items-center justify-center bg-gray-50 py-8'>
      <Card className='w-full max-w-2xl mx-auto'>
        <Card.Header>
          <Card.Header.Title>Business Details</Card.Header.Title>
        </Card.Header>
        <Card.Body>
          <form className='space-y-6'>
            <div>
              <Label htmlFor='business-select'>Business</Label>
              <select
                id='business-select'
                className='block w-full px-3 py-2 text-sm border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 mt-1'
                value={selectedId || ''}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                }}
                aria-label='Select business'
              >
                <option value=''>Select...</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedBusiness && (
              <div className='mt-8 p-6 border rounded bg-gray-50'>
                <h2 className='font-semibold mb-6 text-gray-800 text-lg'>
                  Business Details
                </h2>
                <div className='space-y-4'>
                  <div>
                    <Label htmlFor='business-name'>Business Name</Label>
                    <TextInput
                      id='business-name'
                      value={selectedBusiness.name || ''}
                      readOnly
                      className='mt-1'
                    />
                  </div>
                  <div>
                    <Label htmlFor='address'>Address</Label>
                    <TextInput
                      id='address'
                      value={selectedBusiness.addressLine || ''}
                      readOnly
                      className='mt-1'
                    />
                  </div>
                  <div>
                    <Label htmlFor='street-address'>Street Address</Label>
                    <TextInput
                      id='street-address'
                      value={selectedBusiness.streetAddress || ''}
                      readOnly
                      className='mt-1'
                    />
                  </div>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <div>
                      <Label htmlFor='suburb'>Suburb</Label>
                      <TextInput
                        id='suburb'
                        value={selectedBusiness.suburb || ''}
                        readOnly
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <Label htmlFor='postcode'>Post Code</Label>
                      <TextInput
                        id='postcode'
                        value={selectedBusiness.postcode?.toString() || ''}
                        readOnly
                        className='mt-1'
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor='state'>State</Label>
                    <TextInput
                      id='state'
                      value={selectedBusiness.state || ''}
                      readOnly
                      className='mt-1'
                    />
                  </div>
                </div>
              </div>
            )}
          </form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default BusinessSelect;
