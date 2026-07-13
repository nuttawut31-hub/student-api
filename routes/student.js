const express = require("express");
const router = express.Router();

let students = [
  { id: 1, name: "สมชาย ใจดี", major: "วิทยาการคอมพิวเตอร์" },
  {
    id: 2,
    name: "สมหญิง รักเรียน",
    major: "เทคโนโลยีสารสนเทศ",
  },
];
let nextId = 3;

// GET /  (เทียบเท่ากับ /api/v1/students)
router.get("/", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: students });
});
// GET /:id  (เทียบเท่ากับ /api/v1/students/:id)
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);
  if (!student) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }
  return res.status(200).json({ message: "สำเร็จ", data: student });
});
// POST /  (เทียบเท่ากับ /api/v1/students)
router.post("/", (req, res) => {
  const { name, major } = req.body;
  if (!name || !major) {
    return res
      .status(400)
      .json({ message: "กรุณาระบุ name และ major ให้ครบถ้วน" });
  }
  const newStudent = {
    id: nextId++,
    name,
    major,
  };
  students.push(newStudent);
  return res.status(201).json({ message: "เพิ่มข้อมูลสำเร็จ", data: newStudent });
});
// PUT /:id (เทียบเท่ากับ /api/v1/students/:id)
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, major } = req.body;
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
  return res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: student });
});
// DELETE /:id (เทียบเท่ากับ /api/v1/students/:id)
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = students.findIndex((s) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
  }

  students.splice(index, 1);
  return res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
});

module.exports = router;
