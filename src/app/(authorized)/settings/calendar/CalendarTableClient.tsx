// 'use client';

// import {
//   useReactTable,
//   createColumnHelper,
//   getCoreRowModel,
//   flexRender,
// } from '@tanstack/react-table';
// import { toast } from 'react-toastify';

// import Table from '@/components/table';
// import MONTHS_MAP from '@/constants/map';
// import type { CalendarYearType } from './_types';

// const columnHelper = createColumnHelper<CalendarYearType>();

// export default function CalendarTableClient(){

//   const columns = [
//     columnHelper.accessor('fromYear', {
//       header: () => <span>From Year</span>,
//       cell: (info) => info.getValue(),
//     }),
//     columnHelper.accessor('fromMonth', {
//       header: () => <span>From Month</span>,
//       cell: (info) => MONTHS_MAP.get(info.getValue()),
//     }),
//     columnHelper.accessor('toYear', {
//       header: () => <span>To Year</span>,
//       cell: (info) => info.getValue(),
//     }),
//     columnHelper.accessor('toMonth', {
//       header: () => <span>To Month</span>,
//       cell: (info) => MONTHS_MAP.get(info.getValue()),
//     }),
//     columnHelper.accessor('description', {
//       size: 220,
//       maxSize: 220,
//       header: () => <span>Display</span>,
//       cell: (info) => info.getValue(),
//     }),
//     columnHelper.accessor('type', {
//       header: () => <span>Type</span>,
//       cell: (info) => info.getValue(),
//     }),
//   ];

//   const table = useReactTable<CalendarYearType>({
//     data,
//     columns,
//     getCoreRowModel: getCoreRowModel(),
//     meta: {},
//   });

//   return ();
// }
