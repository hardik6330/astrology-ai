// Kundali: adds locationId to link a kundali to a cached Location row.
// This ensures that we know exactly which coordinates were used to generate
// the chart data, and can re-lookup those coordinates for interpretation.

import { DataTypes } from 'sequelize';

export async function up({ context: q }) {
  await q.addColumn('Kundalis', 'locationId', {
    type: DataTypes.STRING(24),
    allowNull: true,
    references: {
      model: 'Locations',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  });
}

export async function down({ context: q }) {
  await q.removeColumn('Kundalis', 'locationId');
}
