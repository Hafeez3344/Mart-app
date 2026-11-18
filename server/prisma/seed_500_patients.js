const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FIRST_NAMES_MALE = [
  'Muhammad', 'Ahmed', 'Ali', 'Usman', 'Hamza', 'Bilal', 'Zubair', 'Hassan', 'Hussain', 'Tariq',
  'Kamran', 'Farhan', 'Imran', 'Saad', 'Faisal', 'Zayn', 'Umer', 'Asim', 'Babar', 'Daniyal',
  'Haris', 'Kashif', 'Naveed', 'Rizwan', 'Shahid', 'Waqas', 'Yasir', 'Zeeshan', 'Adnan', 'Arslan',
  'Junaid', 'Mustafa', 'Abdullah', 'Talha', 'Moiz', 'Sohail', 'Sheraz', 'Noman', 'Adeel', 'Shahzaib',
  'Rehan', 'Waseem', 'Atif', 'Irfan', 'Aftab', 'Tanveer', 'Naeem', 'Nasir', 'Jamshed', 'Farooq'
];

const FIRST_NAMES_FEMALE = [
  'Fatima', 'Ayesha', 'Zainab', 'Maryam', 'Sana', 'Hira', 'Noor', 'Maham', 'Amna', 'Sadia',
  'Rabia', 'Iqra', 'Sidra', 'Khadija', 'Mehwish', 'Nimra', 'Anam', 'Samina', 'Bushra', 'Farah',
  'Aliza', 'Kinza', 'Zoya', 'Laiba', 'Sundas', 'Nazia', 'Rida', 'Hafsa', 'Saba', 'Madiha',
  'Shazia', 'Kiran', 'Noreen', 'Fouzia', 'Shama', 'Tahira', 'Asia', 'Gulshan', 'Naila', 'Arooj'
];

const LAST_NAMES = [
  'Khan', 'Malik', 'Chaudhry', 'Sheikh', 'Bhatti', 'Raza', 'Qureshi', 'Siddiqui', 'Abbasi', 'Mirza',
  'Butt', 'Dar', 'Gill', 'Javed', 'Akhtar', 'Shah', 'Niazi', 'Ansari', 'Ghafoor', 'Iqbal',
  'Rasheed', 'Rehman', 'Tahir', 'Bashir', 'Mahmood', 'Yousaf', 'Majeed', 'Sharif', 'Afzal', 'Aziz'
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELATIONS = ['Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Guardian', 'Son', 'Daughter'];
const SCHEMES = ['SELF_PAY', 'SELF_PAY', 'SEHAT_CARD', 'PANEL_INSURANCE', 'SELF_PAY'];

async function seedFiveHundredPatients() {
  console.log('🌱 Generating 500 realistic patient records...');

  const existing = await prisma.patient.findMany({
    select: { mrn: true }
  });
  const existingMrns = new Set(existing.map(p => p.mrn));

  const patientsData = [];
  const year = new Date().getFullYear();

  for (let i = 1; i <= 500; i++) {
    const isMale = Math.random() > 0.45;
    const firstName = isMale
      ? FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)]
      : FIRST_NAMES_FEMALE[Math.floor(Math.random() * FIRST_NAMES_FEMALE.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const name = `${firstName} ${lastName}`;
    const gender = isMale ? 'Male' : 'Female';
    const age = Math.floor(Math.random() * 75) + 3; // Age 3 to 78
    const bloodGroup = BLOOD_GROUPS[Math.floor(Math.random() * BLOOD_GROUPS.length)];

    // Distinct MRN
    let mrn;
    do {
      const code = Math.floor(10000 + Math.random() * 90000);
      mrn = `MRN-${year}-${code}`;
    } while (existingMrns.has(mrn));
    existingMrns.add(mrn);

    // Phone: 03XX-XXXXXXX
    const prefixes = ['0300', '0301', '0302', '0303', '0304', '0305', '0306', '0307', '0308', '0321', '0322', '0333', '0334', '0345', '0346', '0312', '0313'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const numPart = Math.floor(1000000 + Math.random() * 9000000);
    const phone = `${prefix}-${numPart}`;

    // CNIC: XXXXX-XXXXXXX-X
    const cnicPart1 = Math.floor(10000 + Math.random() * 90000);
    const cnicPart2 = Math.floor(1000000 + Math.random() * 9000000);
    const cnicPart3 = Math.floor(1 + Math.random() * 9);
    const cnic = `${cnicPart1}-${cnicPart2}-${cnicPart3}`;

    const relativeFirstName = FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)];
    const relativeName = `${relativeFirstName} ${lastName}`;
    const relativeRelation = RELATIONS[Math.floor(Math.random() * RELATIONS.length)];
    const paymentScheme = SCHEMES[Math.floor(Math.random() * SCHEMES.length)];

    // Stagger dates across recent months
    const daysAgo = Math.floor(Math.random() * 90);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60));

    patientsData.push({
      mrn,
      name,
      gender,
      age,
      phone,
      bloodGroup,
      cnic,
      relativeName,
      relativeRelation,
      paymentScheme,
      createdAt
    });
  }

  console.log(`📦 Inserting ${patientsData.length} patient records in chunks...`);
  const CHUNK_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < patientsData.length; i += CHUNK_SIZE) {
    const chunk = patientsData.slice(i, i + CHUNK_SIZE);
    await prisma.patient.createMany({
      data: chunk
    });
    inserted += chunk.length;
    process.stdout.write(`...inserted ${inserted}/${patientsData.length}\r`);
  }

  const finalTotal = await prisma.patient.count();
  console.log(`\n✅ Successfully added 500 patient records!`);
  console.log(`📊 Total Patients in database: ${finalTotal}`);
}

seedFiveHundredPatients()
  .catch((e) => {
    console.error('Error adding 500 patients:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
