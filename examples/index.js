const PardAgent = require('../')
const uuid = require("uuid");


const agent = new PardAgent({
  uuid: process.env.UUID || uuid.v4(),
  interval: 1000,
  mqtt: {
    host: 'mqtt://10.0.0.7'
  }
})

// agent.addMetric('rss', function getRss () {
//   return process.memoryUsage().rss
// })

// agent.addMetric('promiseMetric', function getRandomPromise () {
//   return Promise.resolve(Math.random())
// })

agent.addMetric('callbackMetric', function getRandomCallback (callback) {
  setTimeout(() => {
    callback(null, Math.random())
  }, 1000)
})

agent.connect()

// This agent only
agent.on('connected', handler)
agent.on('disconnected', handler)
agent.on('message', handler)

// Other Agents
agent.on('agent/connected', handler)
agent.on('agent/disconnected', handler)
agent.on('agent/message', handler)

function handler (payload) {
  console.log('payload',payload)
}