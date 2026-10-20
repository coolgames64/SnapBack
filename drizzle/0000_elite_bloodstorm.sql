CREATE TABLE `billing_members` (
	`member` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`checkout_session` text,
	`attempt` integer DEFAULT 1 NOT NULL
);
