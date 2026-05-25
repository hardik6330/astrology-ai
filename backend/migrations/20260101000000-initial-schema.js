// Initial schema: Users, Kundalis, DailyData, ChatMessages, PalmReadings.
// Mirrors the Sequelize models — fresh DBs created via `npm run migrate`
// match what sequelize.sync() would have produced in dev.

import { DataTypes } from 'sequelize';

const STRING_ID  = { type: DataTypes.STRING(24), primaryKey: true };
const FK         = { type: DataTypes.STRING(24), allowNull: false };
const TIMESTAMPS = {
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

export async function up({ context: q }) {
  await q.createTable('Users', {
    id: STRING_ID,
    name:      { type: DataTypes.STRING,  allowNull: false },
    gender:    { type: DataTypes.STRING,  allowNull: true  },
    birthDate: { type: DataTypes.STRING,  allowNull: false },
    birthTime: { type: DataTypes.STRING,  allowNull: false },
    birthCity: { type: DataTypes.STRING,  allowNull: false },
    ...TIMESTAMPS,
  });

  await q.createTable('Kundalis', {
    id: STRING_ID,
    userId: { ...FK, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
    chartData:      { type: DataTypes.JSON, allowNull: false },
    interpretation: { type: DataTypes.JSON, allowNull: false },
    ...TIMESTAMPS,
  });

  await q.createTable('DailyData', {
    id: STRING_ID,
    userId:   { ...FK, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
    date:     { type: DataTypes.DATEONLY, allowNull: false },
    guidance: { type: DataTypes.JSON,     allowNull: false },
    ...TIMESTAMPS,
  });
  await q.addIndex('DailyData', ['userId', 'date']);

  await q.createTable('ChatMessages', {
    id: STRING_ID,
    userId:  { ...FK, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
    role:    { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT,   allowNull: false },
    ...TIMESTAMPS,
  });
  await q.addIndex('ChatMessages', ['userId', 'createdAt']);

  await q.createTable('PalmReadings', {
    id: STRING_ID,
    userId:       { ...FK, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
    handType:     { type: DataTypes.STRING,     allowNull: true },
    imageQuality: { type: DataTypes.STRING,     allowNull: true },
    imageHash:    { type: DataTypes.STRING(64), allowNull: true },
    reading:      { type: DataTypes.JSON,       allowNull: false },
    ...TIMESTAMPS,
  });
  await q.addIndex('PalmReadings', ['userId', 'imageHash']);
}

export async function down({ context: q }) {
  await q.dropTable('PalmReadings');
  await q.dropTable('ChatMessages');
  await q.dropTable('DailyData');
  await q.dropTable('Kundalis');
  await q.dropTable('Users');
}
