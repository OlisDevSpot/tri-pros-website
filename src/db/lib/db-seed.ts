// const tables = process.env.npm_config_tables as keyof typeof schema

export async function seedOneStopSalesDb() {
}

(async () => {
  // eslint-disable-next-line node/prefer-global/process
  switch (process.argv[2]) {
    case 'oneStopSales':
      await seedOneStopSalesDb()
      break
    default:
      throw new Error('Invalid schema')
  }
})()
