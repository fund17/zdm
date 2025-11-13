const { PrismaClient } = require('@prisma/client');

async function updateZmgUserId() {
  const prisma = new PrismaClient();
  
  try {
    // Get all users without zmguserid
    const users = await prisma.user.findMany({
      where: {
        zmguserid: null
      }
    });

    console.log(`Found ${users.length} users without zmguserid`);

    // Update each user with unique zmguserid
    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          zmguserid: `zmg_${user.id}`
        }
      });
      console.log(`Updated user ${user.email} with zmguserid: zmg_${user.id}`);
    }

    console.log('All users updated successfully');
  } catch (error) {
    console.error('Error updating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateZmgUserId();