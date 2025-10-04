CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE Appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department VARCHAR(255) NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
