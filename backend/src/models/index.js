import User from './User.js';
import AuthAccount from './AuthAccount.js';
import Kundali from './Kundali.js';
import DailyData from './DailyData.js';
import ChatMessage from './ChatMessage.js';
import PalmReading from './PalmReading.js';
import PushToken from './PushToken.js';
import Location from './Location.js';
import Admin from './Admin.js';
import Setting from './Setting.js';
import CreditTransaction from './CreditTransaction.js';
import CreditPlan from './CreditPlan.js';
import Purchase from './Purchase.js';
import NotificationTemplate from './NotificationTemplate.js';
import ChartMemory from './ChartMemory.js';
import Subscription from './Subscription.js';

// Relationships
User.hasOne(Kundali, { foreignKey: 'userId', onDelete: 'CASCADE' });
Kundali.belongsTo(User, { foreignKey: 'userId' });

Location.hasMany(Kundali, { foreignKey: 'locationId', onDelete: 'SET NULL' });
Kundali.belongsTo(Location, { foreignKey: 'locationId' });

User.hasMany(DailyData, { foreignKey: 'userId', onDelete: 'CASCADE' });
DailyData.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(ChatMessage, { foreignKey: 'userId', onDelete: 'CASCADE' });
ChatMessage.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(PalmReading, { foreignKey: 'userId', onDelete: 'CASCADE' });
PalmReading.belongsTo(User, { foreignKey: 'userId' });

// Push tokens hang off the auth identity, not the profile — a device belongs to
// whoever logged in, independent of which birth chart they're viewing.
AuthAccount.hasMany(PushToken, { foreignKey: 'accountId', onDelete: 'CASCADE' });
PushToken.belongsTo(AuthAccount, { foreignKey: 'accountId' });

AuthAccount.hasMany(ChartMemory, { foreignKey: 'accountId', onDelete: 'CASCADE' });
ChartMemory.belongsTo(AuthAccount, { foreignKey: 'accountId' });

User.hasMany(CreditTransaction, { foreignKey: 'userId', onDelete: 'CASCADE' });
CreditTransaction.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Purchase, { foreignKey: 'userId', onDelete: 'CASCADE' });
Purchase.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Subscription, { foreignKey: 'userId', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'userId' });
CreditPlan.hasMany(Subscription, { foreignKey: 'planId' });
Subscription.belongsTo(CreditPlan, { foreignKey: 'planId' });

// Plans soft-delete via `active`, so historical purchases keep a resolvable
// planId — this join powers the admin order list's "Plan" column.
CreditPlan.hasMany(Purchase, { foreignKey: 'planId' });
Purchase.belongsTo(CreditPlan, { foreignKey: 'planId' });

// Admin has no association — it's a standalone back-office login.
// Setting + NotificationTemplate are standalone — no associations.

export {
  User, AuthAccount, Kundali, DailyData, ChatMessage, PalmReading,
  PushToken, Location, Admin, Setting, CreditTransaction, CreditPlan,
  Purchase, NotificationTemplate, ChartMemory, Subscription,
};
