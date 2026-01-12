package ru.staffly;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import ru.staffly.auth.config.AuthProperties;
import ru.staffly.push.config.PushProperties;

@SpringBootApplication
@EnableConfigurationProperties({AuthProperties.class, PushProperties.class})
public class StafflyApplication {
    public static void main(String[] args) {
        SpringApplication.run(StafflyApplication.class, args);
    }

}
