package middleware

import "github.com/gin-gonic/gin"

func Error(c *gin.Context, status int, code string) {
	c.Header("Cache-Control", "no-store")
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": code, "message": "The request could not be completed."}})
}
