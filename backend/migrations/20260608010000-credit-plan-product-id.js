export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('CreditPlans', 'productId', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'name',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('CreditPlans', 'productId');
  },
};
