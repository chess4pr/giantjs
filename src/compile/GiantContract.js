import {transformFileSync, transform} from 'babel-core'
import ContractValidator from '../babel/babel-plugin-contract-validator'
import ContractFee from '../babel/babel-plugin-contract-fee'
import ContractCodeReflection from '../babel/babel-plugin-contract-code-reflection'
import fs from 'fs'
import UglifyJS from 'uglify-js'
import GiantPath from '../path'
import figlet from 'figlet'
import logger from '../logger'

export default class GiantContract {

    constructor(name) {
        this.valid = false
        this.compiled = false
        this.name = name
        this.code = {}
        this.code.es5 = false
        this.code.es6 = false
        this.code.es5pfe = false
        this.code.runTime = false
    }

    compile() {
        if (this.valid) {
            let that = this

            /**
             * TODO : pfeDesc - fn for init payment proccess
             */

            let pfeDesc = '\nfunction pfe(pfeVars){console.log(pfeVars)}'

            /**
             * this.code.es6 - the original, readable contract code
             */

            this.code.es6 = fs.readFileSync(GiantPath.getContractFile(this.name), 'utf8')

            fs.writeFileSync(this.GiantPath.getTargetContractFile(this.name), this.code.es6)

            let {code} = transformFileSync(GiantPath.getContractFile(this.name))

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

            fs.writeFileSync(this.GiantPath.getTargetContractFileRunTime(this.name), this.code.runTime.code, 'utf-8')

            this.compiled = true

            figlet('runtime', function (err, data) {
                if (err) {
                    logger.error('Something went wrong...');
                    console.dir(err);
                    return;
                }
                console.log(data)
                logger.warn(`Succeseful! Contract ${that.name} was compiled ${GiantPath.getTargetContractFileRunTime(that.name)}`)
            })
        }
    }

    validate() {
        let that = this

        transformFileSync(GiantPath.getContractFile(this.name), {
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
            logger.warn(`Contract ${that.name} is valid ${GiantPath.getContractFile(that.name)}`)
        })
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

    getCode() {
        if (this.code) {
            return this.code
        } else {
            logger.warn(`Contract code ${this.name} not compiled.`)
        }
    }

    test() {

    }
}
