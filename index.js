'use strict'

const debug = require('debug')('pardsrl:agent')
const os = require('os')
const util = require('util')
const mqtt = require('mqtt')
const defaults = require('defaults')
const EventEmitter = require('events')

const { parsePayload } = require('./utils')

const options = {
  uuid: '0000-0000-0000-0000',
  interval: 5000,
  mqtt: {
    host: 'mqtt://localhost'
  }
}

class PardAgent extends EventEmitter {
  constructor (opts) {
    super()

    this._options = defaults(opts, options)
    this._started = false
    this._timer = null
    this._client = null
    this._agentId = null
    this._metrics = new Map()
  }

  addMetric (type, fn) {
    this._metrics.set(type, fn)
  }

  removeMetric (type) {
    this._metrics.delete(type)
  }

  connect () {
    if (!this._started) {
      const opts = this._options
      this._client = mqtt.connect(opts.mqtt.host)
      this._started = true

      this._client.subscribe('agent/message')
      this._client.subscribe('agent/connected')
      this._client.subscribe('agent/disconnected')

      this._client.on('connect', () => {
        this._agentId = opts.uuid

        this.emit('connected', this._agentId)

        this._report = async () => {
          if (this._metrics.size > 0) {
            let message = {
              agent: {
                uuid: this._agentId,
                hostname: os.hostname() || 'localhost',
                pid: process.pid
              },
              metrics: [],
              timestamp: new Date().getTime()
            }

            for (let [ metric, fn ] of this._metrics) {
              if (fn.length === 1) {
                fn = util.promisify(fn)
              }

              let value = await Promise.resolve(fn())

              let metricObj = {
                type: metric,
                value
              }

              //if provided value its an object, it will be assigned to
              //original metric object
              if (value && typeof value == 'object'){
                metricObj = Object.assign({
                  type: metric,
                  value 
                },value)
              }

             message.metrics.push(metricObj)
            }

            debug('Sending', message)

            this._client.publish('agent/message', JSON.stringify(message))
            this.emit('message', message)

            this._timer = setTimeout(this._report,opts.interval)
          }
        }

        // if report function is not fired, it will be called
        !this._timer && this._report()
      })

      this._client.on('message', (topic, payload) => {
        payload = parsePayload(payload)

        let broadcast = false
        switch (topic) {
          case 'agent/connected':
          case 'agent/disconnected':
          case 'agent/message':
            broadcast = payload && payload.agent && payload.agent.uuid !== this._agentId
            break
        }

        if (broadcast) {
          this.emit(topic, payload)
        }
      })

      this._client.on('error', () => this.disconnect())

      this._client.on('reconnect', () => this.emit('reconnecting'))
    }
  }

  setInterval(interval){
    this._options.interval = interval
  }

  disconnect () {
    if (this._started) {
      this._started = false
      this._timer && clearTimeout(this._timer)
      this.emit('disconnected', this._agentId)
      this._client.end()
    }
  }
}

module.exports = PardAgent