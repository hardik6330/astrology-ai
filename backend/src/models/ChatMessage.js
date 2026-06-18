import { DataTypes } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { genId } from '../utils/genId.js';

// One row per chat turn (user question or astrologer reply) for a user.
const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    defaultValue: () => genId(),
  },
  userId:  { type: DataTypes.STRING(24), allowNull: false },
  role:    { type: DataTypes.STRING, allowNull: false },   // 'user' | 'assistant'
  content: { type: DataTypes.TEXT, allowNull: false },
}, {
  timestamps: true,
  // Every chat turn reads/writes `where userId order by createdAt` — the most
  // frequent query in the app. Without this it's a full scan + filesort.
  indexes: [{ name: 'chat_messages_user_created', fields: ['userId', 'createdAt'] }],
});

export default ChatMessage;
