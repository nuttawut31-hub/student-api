const { buildSchema } = require("graphql");

const schema = buildSchema(`
type Course {
  id: ID!
  courseName: String!
  credit: Int!
}

type Student {
  id: ID!
  name: String!
  major: String!
  email: String!
  phone: String!
  courses: [Course!]!
}

type Query {
  student(id: ID!): Student
  students: [Student!]!
}
`);

module.exports = schema;
