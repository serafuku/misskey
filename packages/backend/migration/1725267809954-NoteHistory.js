/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */


export class NoteHistory1725267809954 {
	name = 'NoteHistory1725267809954';

	async up(queryRunner) {
		await queryRunner.query('CREATE TABLE "note_history" ("id" character varying(32) NOT NULL, "noteId" character varying(32) NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "fileIds" character varying(32) array NOT NULL DEFAULT \'{}\', "attachedFileTypes" character varying(256) array NOT NULL DEFAULT \'{}\', "emojis" character varying(128) array NOT NULL DEFAULT \'{}\', "noteIdId" character varying(32), "userIdId" character varying(32), CONSTRAINT "PK_b8603c8aa42b803c7687e52c2c0" PRIMARY KEY ("id")); COMMENT ON COLUMN "note_history"."noteId" IS \'The target Note ID for history\'');
		await queryRunner.query('CREATE INDEX "IDX_1e2492ba7582bf830b750a2962" ON "note_history" ("noteId") ');
		await queryRunner.query('ALTER TABLE "note_history" ADD CONSTRAINT "FK_087d222cdeb6ed35b7c0ae7a67f" FOREIGN KEY ("noteIdId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
		await queryRunner.query('ALTER TABLE "note_history" ADD CONSTRAINT "FK_31ef25f0b13c2791ae74f895ee2" FOREIGN KEY ("userIdId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "note_history" DROP CONSTRAINT "FK_31ef25f0b13c2791ae74f895ee2"');
		await queryRunner.query('ALTER TABLE "note_history" DROP CONSTRAINT "FK_087d222cdeb6ed35b7c0ae7a67f"');
		await queryRunner.query('DROP INDEX "public"."IDX_1e2492ba7582bf830b750a2962"');
		await queryRunner.query('DROP TABLE "note_history"');
	}
};
