const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ message: "Student API พร้อมใช้งาน" });
});

let students = [
  {
    id: 1,
    name: "สมชาย ใจดี",
    major: "วิทยาการคอมพิวเตอร์",
    email: "somchai@example.com",
    phone: "080-000-0001",
    courseIds: [101, 102],
  },
  {
    id: 2,
    name: "สมหญิง รักเรียน",
    major: "เทคโนโลยีสารสนเทศ",
    email: "somying@example.com",
    phone: "080-000-0002",
    courseIds: [102],
  },
];

let courses = [
  { id: 101, courseName: "การเขียนโปรแกรมเบื้องต้น", credit: 3 },
  { id: 102, courseName: "โครงสร้างข้อมูล", credit: 3 },
];

// === REST Endpoints สำหรับนักศึกษา ===

// 1. GET /api/v1/students (ดึงรายการนักศึกษาทั้งหมด)
app.get("/api/v1/students", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: students });
});

// 2. GET /api/v1/students/:id/full (ดึงข้อมูลนักศึกษาพร้อมวิชาลงทะเบียนตัวเต็ม)
app.get("/api/v1/students/:id/full", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  const studentCourses = courses.filter((c) =>
    student.courseIds.includes(c.id),
  );

  res.status(200).json({
    message: "สำเร็จ",
    data: { ...student, courses: studentCourses },
  });
});

// 3. GET /api/v1/students/:id (ดึงข้อมูลนักศึกษารายบุคคล)
app.get("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);
  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }
  return res.status(200).json({ message: "สำเร็จ", data: student });
});

// 4. POST /api/v1/students (เพิ่มนักศึกษาใหม่)
app.post("/api/v1/students", (req, res) => {
  const { name, major, email, phone, courseIds } = req.body;
  if (!name || !major) {
    return res
      .status(400)
      .json({ message: "กรุณาระบุ name และ major ให้ครบถ้วน" });
  }
  const newStudent = {
    id: nextStudentId++,
    name,
    major,
    email: email || "",
    phone: phone || "",
    courseIds: courseIds || [],
  };
  students.push(newStudent);
  return res
    .status(201)
    .json({ message: "เพิ่มข้อมูลสำเร็จ", data: newStudent });
});

// 5. PUT /api/v1/students/:id (แก้ไขข้อมูลนักศึกษา)
app.put("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, major, email, phone, courseIds } = req.body;
  const student = students.find((s) => s.id === id);
  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  if (!name || !major) {
    return res
      .status(400)
      .json({ message: "กรุณาระบุ name และ major ให้ครบถ้วน" });
  }

  student.name = name;
  student.major = major;
  if (email !== undefined) student.email = email;
  if (phone !== undefined) student.phone = phone;
  if (courseIds !== undefined) student.courseIds = courseIds;

  return res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: student });
});

// 6. DELETE /api/v1/students/:id (ลบข้อมูลนักศึกษา)
app.delete("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = students.findIndex((s) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  students.splice(index, 1);
  return res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
});

// นำเข้าและตั้งค่า GraphQL
const { graphqlHTTP } = require("express-graphql");
const schema = require("./schema");
const resolvers = require("./resolvers");

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: resolvers,
    graphiql: true,
  }),
);

app.listen(port, () => {
  console.log(`Server กำลังทำงานที่ PORT ${port}`);
});
