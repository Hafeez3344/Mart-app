const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FIRST_NAMES_MALE = [
  'Muhammad', 'Ahmed', 'Ali', 'Usman', 'Hamza', 'Bilal', 'Zubair', 'Hassan', 'Hussain', 'Tariq',
  'Kamran', 'Farhan', 'Imran', 'Saad', 'Faisal', 'Zayn', 'Umer', 'Asim', 'Babar', 'Daniyal',
  'Haris', 'Kashif', 'Naveed', 'Rizwan', 'Shahid', 'Waqas', 'Yasir', 'Zeeshan', 'Adnan', 'Arslan'
];

const FIRST_NAMES_FEMALE = [
  'Fatima', 'Ayesha', 'Zainab', 'Maryam', 'Sana', 'Hira', 'Noor', 'Maham', 'Amna', 'Sadia',
  'Rabia', 'Iqra', 'Sidra', 'Khadija', 'Mehwish', 'Nimra', 'Anam', 'Samina', 'Bushra', 'Farah'
];

const LAST_NAMES = [
  'Khan', 'Malik', 'Chaudhry', 'Sheikh', 'Bhatti', 'Raza', 'Qureshi', 'Siddiqui', 'Abbasi', 'Mirza',
  'Butt', 'Dar', 'Gill', 'Javed', 'Akhtar', 'Shah', 'Niazi', 'Ansari', 'Ghafoor', 'Iqbal'
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELATIONS = ['Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Guardian', 'Son', 'Daughter'];
const SCHEMES = ['SELF_PAY', 'SEHAT_CARD', 'PANEL_INSURANCE', 'SELF_PAY', 'SELF_PAY'];

async function seedFiftyPatients() {
  console.log('🌱 Adding 50 realistic patient records...');

  // Fetch existing MRNs to avoid collision
  const existing = await prisma.patient.findMany({
    select: { mrn: true }
  });
  const existingMrns = new Set(existing.map(p => p.mrn));

  const patientsData = [];
  const year = new Date().getFullYear();

  for (let i = 1; i <= 50; i++) {
    const isMale = Math.random() > 0.4;
    const firstName = isMale
      ? FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)]
      : FIRST_NAMES_FEMALE[Math.floor(Math.random() * FIRST_NAMES_FEMALE.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const name = `${firstName} ${lastName}`;
    const gender = isMale ? 'Male' : 'Female';
    const age = Math.floor(Math.random() * 70) + 5; // Age between 5 and 75
    const bloodGroup = BLOOD_GROUPS[Math.floor(Math.random() * BLOOD_GROUPS.length)];
    
    // Generate distinct MRN
    let mrn;
    do {
      const code = Math.floor(1000 + Math.random() * 9000);
      mrn = `MRN-${year}-${code}`;
    } while (existingMrns.has(mrn));
    existingMrns.add(mrn);

    // Phone: 03XX-XXXXXXX
    const prefix = ['0300', '0301', '0302', '0321', '0333', '0345', '0312'][Math.floor(Math.random() * 7)];
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
      paymentScheme
    });
  }

  let createdCount = 0;
  for (const p of patientsData) {
    await prisma.patient.create({
      data: p
    });
    createdCount++;
  }

  const totalPatients = await prisma.patient.count();
  console.log(`✅ Successfully inserted ${createdCount} new patients!`);
  console.log(`📊 Total patients in database now: ${totalPatients}`);
}

seedFiftyPatients()
  .catch((e) => {
    console.error('Error adding patients:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
