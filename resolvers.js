let students = [
  {
    id: 1,
    name: "สมชาย ใจดี",
    major: "วิทวิ ยาการคอมพิวพิเตอร์",
    email: "somchai@example.com",
    phone: "080-000-0001",
    courseIds: [101, 102],
  },
  {
    id: 2,
    name: "สมหญิงญิ รักเรียรีน",
    major: "เทคโนโลยีสายี รสนเทศ",
    email: "somying@example.com",
    phone: "080-000-0002",
    courseIds: [102],
  },
];
let courses = [
  { id: 101, courseName: "การเขียขีนโปรแกรมเบื้อบื้ งต้นต้ ", credit: 3 },
  { id: 102, courseName: "โครงสร้าร้งข้อข้มูลมู ", credit: 3 },
];
function resolveStudent(student) {
  return {
    ...student,
    courses: courses.filter((c) => student.courseIds.includes(c.id)),
  };
}
const root = {
  student: ({ id }) => {
    const student = students.find((s) => s.id === Number(id));
    return student ? resolveStudent(student) : null;
  },
  students: () => students.map(resolveStudent),
};
module.exports = root;
