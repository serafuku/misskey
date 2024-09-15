/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteTimeBomb1725797935955 {
	name = 'NoteTimeBomb1725797935955'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "note_time_bomb" ("id" character varying(32) NOT NULL, "noteId" character varying(32) NOT NULL, "timeBombAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32) NOT NULL, CONSTRAINT "PK_fd3cba89db8d448f4143eb3b931" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_7706fe1d913719cde449f5afb8" ON "note_time_bomb" ("noteId") `);
		await queryRunner.query(`ALTER TABLE "note_time_bomb" ADD CONSTRAINT "FK_7706fe1d913719cde449f5afb8e" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "note_time_bomb" ADD CONSTRAINT "FK_6680e4e79e685aa5e11ab79695e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_time_bomb" DROP CONSTRAINT "FK_6680e4e79e685aa5e11ab79695e"`);
		await queryRunner.query(`ALTER TABLE "note_time_bomb" DROP CONSTRAINT "FK_7706fe1d913719cde449f5afb8e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7706fe1d913719cde449f5afb8"`);
		await queryRunner.query(`DROP TABLE "note_time_bomb"`);
	}
}
