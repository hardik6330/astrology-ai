// A purchasable credit package, defined by the back-office admin. The clients
// list the active plans; buying one grants `credits` via creditService.grant().
// Price is stored in paise (integer) to avoid floating-point rupee math.

import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

const CreditPlan = sequelize.define('CreditPlan', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  name:      { type: DataTypes.STRING(80), allowNull: false },
  credits:   { type: DataTypes.INTEGER, allowNull: false },        // granted on purchase
  priceInr:  { type: DataTypes.INTEGER, allowNull: false },        // price in paise (₹1 = 100)
  // Optional marketing badge, e.g. "Most Popular" / "Best Value".
  bonusLabel: { type: DataTypes.STRING(60), allowNull: true },
  // Soft-disable instead of deleting, so historical Purchases keep a valid ref.
  active:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { timestamps: true });

export default CreditPlan;
