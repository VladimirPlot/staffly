package ru.staffly.avatar.service;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface AvatarService {
    String uploadUserAvatar(Long userId, MultipartFile file);
    Resource getAvatar(String filename);
}