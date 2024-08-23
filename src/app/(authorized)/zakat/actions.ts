'use server';

import type { ZakatPaymentType } from './_types';

export async function addRow() {
  console.log('edit row in server');
  return { success: true, error: null };
}

export async function editRow(rowId: string, record: ZakatPaymentType) {
  console.log('edit row in server');
  return { success: true, error: null };
}

export async function deleteRow() {
  console.log('edit row in server');
  return { success: true, error: null };
}
