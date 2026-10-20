CREATE TABLE `ai_usage` (
	`member` text NOT NULL,
	`period` text NOT NULL,
	`requests` integer NOT NULL,
	`last_request` integer NOT NULL,
	PRIMARY KEY(`member`, `period`)
);
