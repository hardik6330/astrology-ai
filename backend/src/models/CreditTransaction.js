// Append-only ledger of every credit movement. One row per grant or spend, so
// the user's balance history is auditable independent of the live User.credits
// snapshot. `amount` is positive for grants, negative for spends; `balance` is
// the resulting balance after the row was applied.

import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

const CreditTransaction = sequelize.define('CreditTransaction', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  userId:  { type: DataTypes.STRING(24), allowNull: false },
  amount:  { type: DataTypes.INTEGER, allowNull: false },  // + grant / − spend
  balance: { type: DataTypes.INTEGER, allowNull: false },  // balance after this txn
  // signup_bonus | chat | insights | daily | palm | admin | purchase
  reason:  { type: DataTypes.STRING(40), allowNull: false },
  meta:    { type: DataTypes.JSON, allowNull: true },       // optional context
}, {
  timestamps: true,
  // Credit-history reads filter `where userId order by createdAt`.
  indexes: [{ name: 'credit_transactions_user_created', fields: ['userId', 'createdAt'] }],
});

export default CreditTransaction;
