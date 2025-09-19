package ru.staffly.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@Configuration
@EnableMethodSecurity // включает @PreAuthorize/@PostAuthorize
public class MethodSecurityConfig { }