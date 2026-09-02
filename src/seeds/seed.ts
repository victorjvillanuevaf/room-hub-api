import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Building } from '../modules/buildings/entities/building.entity';
import { Room } from '../modules/rooms/entities/room.entity';
import { User } from '../modules/users/entities/user.entity';
import { Reservation } from '../modules/reservations/entities/reservation.entity';

type SeedBuilding = {
  name: string;
  address: string;
};

const buildingsToSeed: SeedBuilding[] = [
  { name: 'Edificio A', address: 'Av Roosevelt Nro 119' },
  { name: 'Edificio B', address: 'Tomás Ramsey 220 - Magdalena' },
  { name: 'Edificio C', address: 'Av. 28 de Julio 674 - Miraflores' },
];

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Building, Room, Reservation],
  synchronize: false,
});

function getCapacity(roomIndex: number): number {
  return roomIndex % 2 === 0 ? 25 : 15;
}

async function seedBuildingsAndRooms(): Promise<void> {
  await dataSource.initialize();

  const buildingRepo = dataSource.getRepository(Building);
  const roomRepo = dataSource.getRepository(Room);

  for (const buildingInput of buildingsToSeed) {
    let building = await buildingRepo.findOne({
      where: { name: buildingInput.name },
    });

    if (!building) {
      building = buildingRepo.create(buildingInput);
      building = await buildingRepo.save(building);
      console.log(`Building created: ${building.name}`);
    } else if (building.address !== buildingInput.address) {
      building.address = buildingInput.address;
      building = await buildingRepo.save(building);
      console.log(`Building updated: ${building.name}`);
    }

    for (let roomNumber = 1; roomNumber <= 15; roomNumber += 1) {
      const roomName = `Sala ${roomNumber}`;
      const capacity = getCapacity(roomNumber);
      const imageUrl = null;

      let room = await roomRepo.findOne({
        where: {
          buildingId: building.id,
          name: roomName,
        },
      });

      if (!room) {
        room = roomRepo.create({
          buildingId: building.id,
          name: roomName,
          capacity,
          imageUrl,
        });
        await roomRepo.save(room);
        console.log(`Room created: ${building.name} - ${roomName}`);
      } else {
        room.capacity = capacity;
        room.imageUrl = imageUrl;
        await roomRepo.save(room);
      }
    }
  }

  await dataSource.destroy();
  console.log('Seed completed successfully.');
}

seedBuildingsAndRooms().catch(async (error: unknown) => {
  console.error('Seed failed:', error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
