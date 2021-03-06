import {transformFileSync, transform} from 'babel-core'
import ContractValidator from '../babel/babel-plugin-contract-validator'
import ContractFee from '../babel/babel-plugin-contract-fee'
import ContractCodeReflection from '../babel/babel-plugin-contract-code-reflection'
import fs from 'fs'
import UglifyJS from 'uglify-js'
import GiantPath from '../path'
import figlet from 'figlet'
import logger from '../logger'
import giantConfig from "../config";

export default class GiantContract {

    constructor(name) {
        this.valid = null
        this.compiled = null
        this.name = name
        this.code = {}
        this.code.es5 = null
        this.code.es6 = null
        this.code.es5pfe = null
        this.code.runTime = null
        this.pfeVars = null
        this.fileName = GiantPath.getContractFile(name)
        this.targetFileName = GiantPath.getTargetContractFile(name)
        this.targetFileNameRunTime = GiantPath.getTargetContractFileRunTime(name)
        this.pfeAmount = 0
    }

    /**
     * WP some methods List
     *
     * getCallerAddress - White Paper method
     */

    getCallerAddress() {
        if (giantConfig.debug) {
            logger.warn(`Called method GiantContract.getCallerAddress, return ${giantConfig.caller.publicKey}`)
        }
        return giantConfig.caller.publicKey
    }

    /**
     * getCallerPremine - White Paper method
     */

    getCallerPremine() {
        if (giantConfig.debug) {
            logger.warn(`Called method GiantContract.getCallerPremine, return ${giantConfig.caller.premine}`)
        }
        return giantConfig.caller.premine
    }

    /**
     * getOwnerAddress - White Paper method
     */

    getOwnerAddress() {
        if (giantConfig.debug) {
            logger.warn(`Called method GiantContract.getOwnerAddress, return ${giantConfig.owner.publicKey}`)
        }

        return giantConfig.owner.publicKey
    }

    /**
     * getOwnerPremine - White Paper method
     */

    getOwnerPremine() {
        if (giantConfig.debug) {
            logger.warn(`Called method GiantContract.getOwnerPremine, return ${giantConfig.owner.premine}`)
        }
        return giantConfig.owner.premine
    }

    compile() {
        let self = this

        if (this.valid) {
            let self = this

            fs.writeFileSync(this.targetFileNameRunTime, this.code.runTime.code, 'utf-8')

            this.compiled = true

            figlet('runtime', function (err, data) {
                if (err) {
                    logger.error('Something went wrong...');
                    console.dir(err);
                    return;
                }

                console.log(data)

                logger.warn(`Succeseful! Contract ${self.name} was compiled ${GiantPath.getTargetContractFileRunTime(self.name)}`)

                console.log('')
                logger.info(`FULL CONTRACT AMOUNT (someContract.metadata.deployFee)  :  ${self.pfeAmount} GIC \n`)
            })
        }
    }


    validate() {
        let self = this

        /**
         * TODO : pfeDesc - fn for init payment proccess
         */
        let pfeDesc = '\nfunction pfe(pfeVars){ ' + this.name + '.pfeVars = pfeVars; console.log(pfeVars)}'

        /**
         * this.code.es6 - the original, readable contract code
         */

        this.code.es6 = fs.readFileSync(this.fileName, 'utf8')

        fs.writeFileSync(this.targetFileName, this.code.es6)

        let {code} = transformFileSync(this.fileName)

        /**
         * this.code.es5 - the es5 transpiled code
         */

        this.code.es5 = code

        let result = transform(this.code.es5, {
            'plugins': [ContractFee]
        })

        /**
         * this.code.es5pfe - the es5 contract code and pfe
         */

        this.code.es5pfe = result.code + pfeDesc

        /**
         * this.code.runTime - final, runtime version
         */

        this.code.runTime = UglifyJS.minify(this.code.es5pfe)

        this.mountModule((ContractClass) => {
            let contractObject = new ContractClass.default("A")

            this.pfeVars = contractObject.getPfe()

            let giantConfigDebug = giantConfig.debug

            for (let i in this.pfeVars) {
                if (i == 'WhitePaper') {
                    logger.warn(`Found WhitePaper Declarations`)

                    console.log(this.pfeVars['WhitePaper'])

                    if (typeof this.pfeVars['WhitePaper'].count == 'undefined') {
                        logger.error(`WhitePaper count undefined`)
                    }
                }

                if (this.pfeVars[i].count) {
                    this.pfeAmount += this.pfeVars[i].count * this.pfeVars[i].fee

                    if (giantConfig.debug) {
                        console.log(`Declaration ${i} counted`)
                    }
                }
            }

            giantConfig.debug = giantConfigDebug

            logger.warn(`Contract full pfe amount ${this.pfeAmount}`)

            /**
             * call other wp methods
             */
            console.log(`!!! wp method !!!`)
            console.log(`Owner Info ${contractObject.getNodeOwner()}`)
            console.log(`Caller Info ${contractObject.getCallerAddress()} `)
            console.log(`Caller premine balance ${contractObject.getCallerBalance()} `)

        })

        transformFileSync(this.fileName, {
            'plugins': [ContractValidator]
        })

        this.valid = true

        figlet('valid es6', function (err, data) {
            if (err) {
                logger.error('Something went wrong...');
                console.dir(err);
                return;
            }
            console.log(data)
            logger.warn(`Contract ${self.name} is valid ${GiantPath.getContractFile(self.name)}`)
        })
    }

    mountModule(cb) {
        const m = require('module'), moduleName = `Deploy`

        var res = require('vm').runInThisContext(m.wrap(this.code.runTime.code))(exports, require, module, __filename, __dirname)

        logger.info(`Mount module ${moduleName}`)

        cb(module.exports)
    }

    getMetadata() {
        const result = transform(this.code.es6, {
            plugins: [
                [ContractCodeReflection]
            ],
            ast: true,
            comments: false,
            code: false
        })
        this.metadata = result.ast.metadata
        return this.metadata
    }

    multiplePayment(mockCaller, contractAddressArr, billAmount, cb) {
        logger.warn(`Multiple payment : ${contractAddressArr.length} wallets. Sending ${billAmount} GIC for each : `)

        for (let i in contractAddressArr) {
            if (typeof contractAddressArr[i] != 'undefined') {
                //logger.warn(`${contractAddressArr[i].publicKey} balance before tx ${contractAddressArr[i].premine}.`)
                const from = this.getCallerAddress()
                const to = contractAddressArr[i].publicKey
                /**
                 * call contractAddressArr txs type transfer
                 */
                mockCaller.sendFrom(from, to, billAmount)
            }
        }
        cb({'status': true})
    }

    getCode() {
        if (this.code) {
            return this.code
        } else {
            logger.warn(`Contract code ${this.name} not compiled.`)
        }
    }
}
