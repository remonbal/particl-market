// Copyright (c) 2017-2020, The Particl Market developers
// Distributed under the GPL software license, see the accompanying
// file COPYING or https://github.com/particl/particl-market/blob/develop/LICENSE

/**
 * console.Commander
 * ------------------------------------------------
 *
 * Here you can define your console commands, so you are able
 * to use them in the terminal with 'npm run console <command>'.
 *
 * These console commands can also be accessed in the production
 * environment. For example to import users.
 */

import 'reflect-metadata';
import * as glob from 'glob';
import * as path from 'path';
import * as commander from 'commander';
import * as figlet from 'figlet';
import * as chalk from 'chalk';

// It also loads the .env file into the 'process.env' variable.
import { config } from 'dotenv';
config();

// Configures the logger
import { LoggerConfig } from '../../config/LoggerConfig';
new LoggerConfig().configure();

figlet('console', (error: any, data: any) => {
    console.log(chalk.blue(data));

    // Find all command files
    glob(path.join(__dirname, '../**/*Command.ts'), (err: any, matches: string[]) => {
        if (err) {
            console.log(err);
            return;
        }

        const files = matches
            .filter(m => m.search(/\/lib/g) <= 0)
            .map(m => ({
                path: m,
                name: m.replace(__dirname.split(path.sep).join('/').replace('/lib', ''), '').replace('.ts', '').substring(1)
            }));

        const commands = files.map(f => require(f.path)[f.name]);
        const keys = commands.map(c => {
            return c.command;
        });
        const key = process.argv[2];

        if (keys.indexOf(key) < 0 && key !== '--help') {
            console.log(chalk.red('➜ ') + chalk.bold(`Command ${key} was not found!`));
            console.log();
            return;
        }

        if (key !== '--help') {
            console.log(chalk.green('➜ ') + chalk.bold(key));
            console.log();
        }

        commands.forEach((c) => {
            commander
                .command(c.command)
                .description(c.description)
                .action(() => c.action(new c()));
        });

        commander.parse(process.argv);

    });
});
