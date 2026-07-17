const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ message: "Student API พร้อมใช้งาน" });
});

// นำเข้า router ของนักศึกษา
const studentRouter = require("./routes/student");
app.use("/api/v1/students", studentRouter);

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
  })
);

let courses = [
  { id: 1, courseCode: "CS101", courseName: "Programming 101" },
  { id: 2, courseCode: "IT202", courseName: "Database Systems" }
];
let nextCourseId = 3;

// 1. GET /api/v1/courses (ดึงข้อมูลรายวิชาทั้งหมด)
app.get("/api/v1/courses", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: courses });
});

// 2. GET /api/v1/courses/:id (ดึงข้อมูลรายวิชาตาม ID)
app.get("/api/v1/courses/:id", (req, res) => {
  const id = Number(req.params.id);
  const course = courses.find((c) => c.id === id);
  
  if (!course) {
    return res.status(404).json({ message: "ไม่พบข้อมูลรายวิชา" });
  }
  return res.status(200).json({ message: "สำเร็จ", data: course });
});

// 3. POST /api/v1/courses (เพิ่มข้อมูลรายวิชาใหม่)
app.post("/api/v1/courses", (req, res) => {
  const { courseCode, courseName } = req.body;
  
  if (!courseCode || !courseName) {
    return res.status(400).json({ message: "กรุณาระบุ courseCode และ courseName ให้ครบถ้วน" });
  }
  
  const newCourse = {
    id: nextCourseId++,
    courseCode,
    courseName,
  };
  
  courses.push(newCourse);
  return res.status(201).json({ message: "สร้างรายวิชาสำเร็จ", data: newCourse });
});

// 4. PUT /api/v1/courses/:id (แก้ไขข้อมูลรายวิชา)
app.put("/api/v1/courses/:id", (req, res) => {
  const id = Number(req.params.id);
  const { courseCode, courseName } = req.body;
  const course = courses.find((c) => c.id === id);
  
  if (!course) {
    return res.status(404).json({ message: "ไม่พบข้อมูลรายวิชา" });
  }

  if (!courseCode || !courseName) {
    return res.status(400).json({ message: "กรุณาระบุ courseCode และ courseName ให้ครบถ้วน" });
  }

  course.courseCode = courseCode;
  course.courseName = courseName;
  return res.status(200).json({ message: "แก้ไขรายวิชาสำเร็จ", data: course });
});

// 5. DELETE /api/v1/courses/:id (ลบข้อมูลรายวิชา)
app.delete("/api/v1/courses/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = courses.findIndex((c) => c.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "ไม่พบข้อมูลรายวิชา" });
  }

  courses.splice(index, 1);
  return res.status(200).json({ message: "ลบรายวิชาสำเร็จ" });
});

app.listen(port, () => {
  console.log(`Server กำลังทำงานที่ PORT ${port}`);
});
