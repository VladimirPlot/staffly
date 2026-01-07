package ru.staffly;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import ru.staffly.auth.config.AuthProperties;

@SpringBootApplication
@EnableConfigurationProperties(AuthProperties.class)
public class StafflyApplication {
    public static void main(String[] args) {
        SpringApplication.run(StafflyApplication.class, args);
    }

}