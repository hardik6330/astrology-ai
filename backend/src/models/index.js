import User from './User.js';
import AuthAccount from './AuthAccount.js';
import Kundali from './Kundali.js';
import DailyData from './DailyData.js';
import ChatMessage from './ChatMessage.js';
import PalmReading from './PalmReading.js';
import PushToken from './PushToken.js';
import Location from './Location.js';

// Relationships
User.hasOne(Kundali, { foreignKey: 'userId', onDelete: 'CASCADE' });
Kundali.belongsTo(User, { foreignKey: 'userId' });

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

export { User, AuthAccount, Kundali, DailyData, ChatMessage, PalmReading, PushToken, Location };
